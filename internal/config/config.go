package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

// Config holds all configuration for the bridge
type Config struct {
	WebhookURL string
	OpenClaw   OpenClawConfig
	UID        string // Unique ID for this bridge instance

	// Session configuration
	SessionStorePath string // Path to session store JSON file
	SessionScope     string // Session scope: "per-sender" or "global"
}

// OpenClawConfig contains OpenClaw Gateway configuration
type OpenClawConfig struct {
	GatewayPort  int
	GatewayToken string
	AgentID      string
}

// openclawJSON matches ~/.openclaw/openclaw.json (managed by OpenClaw)
type openclawJSON struct {
	Gateway struct {
		Port int `json:"port"`
		Auth struct {
			Token string `json:"token"`
		} `json:"auth"`
	} `json:"gateway"`
}

// bridgeJSON matches ~/.openclaw/bridge.json
type bridgeJSON struct {
	WebhookURL string `json:"webhook_url"`
	AgentID    string `json:"agent_id,omitempty"`
	UID        string `json:"uid,omitempty"` // Optional pre-configured UID
}

// Dir returns the config directory path
// Tries ~/.openclaw first, falls back to ~/.openclaw
func Dir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get home directory: %w", err)
	}

	// Priority order: .openclaw, .openclaw
	candidates := []string{
		filepath.Join(home, ".openclaw"),
		filepath.Join(home, ".openclaw"),
	}

	// Return first existing directory, or default to .openclaw
	for _, dir := range candidates {
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			return dir, nil
		}
	}

	// Default to .openclaw if none exist
	return candidates[0], nil
}

// findConfigFile searches for a config file with multiple possible names
// Returns the first file found, or error if none exist
func findConfigFile(dir string, candidates ...string) (string, error) {
	for _, name := range candidates {
		path := filepath.Join(dir, name)
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}
	// Return error with all attempted paths
	return "", fmt.Errorf("config file not found, tried: %v", candidates)
}

// Load reads configuration from config files
// Supports both ~/.openclaw/ and ~/.openclaw/ directories
// Gateway config: openclaw.json or openclaw.json
// Bridge config: bridge.json
func Load() (*Config, error) {
	dir, err := Dir()
	if err != nil {
		return nil, err
	}

	// Find gateway config file: openclaw.json or openclaw.json
	gwPath, err := findConfigFile(dir, "openclaw.json", "openclaw.json")
	if err != nil {
		return nil, fmt.Errorf("failed to find gateway config (openclaw.json or openclaw.json) in %s: %w", dir, err)
	}
	gwData, err := os.ReadFile(gwPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read %s: %w", gwPath, err)
	}
	var gwCfg openclawJSON
	if err := json.Unmarshal(gwData, &gwCfg); err != nil {
		return nil, fmt.Errorf("failed to parse %s: %w", gwPath, err)
	}

	// Find bridge config file: bridge.json
	brPath, err := findConfigFile(dir, "bridge.json")
	if err != nil {
		return nil, fmt.Errorf(
			"failed to find bridge.json in %s: %w\n\nCreate it with:\n  {\n    \"webhook_url\": \"ws://localhost:8080/ws\"\n  }", dir, err)
	}
	brData, err := os.ReadFile(brPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read %s: %w", brPath, err)
	}
	var brCfg bridgeJSON
	if err := json.Unmarshal(brData, &brCfg); err != nil {
		return nil, fmt.Errorf("failed to parse %s: %w", brPath, err)
	}

	// Validate required fields
	if brCfg.WebhookURL == "" {
		return nil, fmt.Errorf("webhook_url is required in ~/.openclaw/bridge.json")
	}

	// Build config with defaults
	cfg := &Config{
		WebhookURL: brCfg.WebhookURL,
		OpenClaw: OpenClawConfig{
			GatewayPort: gwCfg.Gateway.Port,
			GatewayToken: gwCfg.Gateway.Auth.Token,
			AgentID:      "main",
		},
	}

	if brCfg.AgentID != "" {
		cfg.OpenClaw.AgentID = brCfg.AgentID
	}
	if cfg.OpenClaw.GatewayPort == 0 {
		cfg.OpenClaw.GatewayPort = 18789
	}

	// Generate or set UID
	if brCfg.UID != "" {
		cfg.UID = brCfg.UID
	} else {
		cfg.UID = generateUID()
	}

	// Set session store path
	cfg.SessionStorePath = filepath.Join(dir, "sessions.json")

	// Session scope defaults to per-sender
	cfg.SessionScope = "per-sender"

	return cfg, nil
}

// generateUID generates a unique ID for this bridge instance
// Uses UUID v4 for uniqueness
func generateUID() string {
	return uuid.New().String()
}

// GetDisplayUID returns a formatted display string for the UID
func GetDisplayUID(cfg *Config) string {
	return fmt.Sprintf("Bridge UID: %s", cfg.UID)
}
