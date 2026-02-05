//go:build release

package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/skip2/go-qrcode"
	"github.com/sternelee/openclaw-webhook-bridge/internal/bridge"
	"github.com/sternelee/openclaw-webhook-bridge/internal/config"
	"github.com/sternelee/openclaw-webhook-bridge/internal/openclaw"
	"github.com/sternelee/openclaw-webhook-bridge/internal/sessions"
	"github.com/sternelee/openclaw-webhook-bridge/internal/webhook"
)

func main() {
	cmd := "run"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}

	switch cmd {
	case "start":
		applyConfigArgs(os.Args[2:])
		cmdStartRelease()
	case "stop":
		cmdStop()
	case "status":
		cmdStatus()
	case "restart":
		applyConfigArgs(os.Args[2:])
		dir, _ := config.Dir()
		pidPath := filepath.Join(dir, "bridge.pid")
		if pid, err := readPID(pidPath); err == nil {
			stopProcess(pid)
			for i := 0; i < 10; i++ {
				time.Sleep(200 * time.Millisecond)
				if !isProcessRunning(pid) {
					break
				}
			}
			os.Remove(pidPath)
		}
		cmdStartRelease()
	case "run":
		if len(os.Args) > 2 {
			applyConfigArgs(os.Args[2:])
		}
		cmdRunRelease()
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n\nUsage:\n  openclaw-bridge start [webhook_url=ws://...]\n  openclaw-bridge stop\n  openclaw-bridge status\n  openclaw-bridge restart\n  openclaw-bridge run\n", cmd)
		os.Exit(1)
	}
}

// cmdStartRelease starts the bridge without logging to file (release build)
func cmdStartRelease() {
	dir, err := config.Dir()
	if err != nil {
		log.Fatal(err)
	}

	pidPath := filepath.Join(dir, "bridge.pid")

	// Check if already running
	if isRunning(pidPath) {
		fmt.Println("Already running")
		os.Exit(1)
	}

	// Validate config before daemonizing so errors are visible
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Config error: %v", err)
	}

	// Display UID prominently before daemonizing
	fmt.Println()
	fmt.Println("╔══════════════════════════════════════════════════════════╗")
	fmt.Printf("║  %-50s                                         ║\n", config.GetDisplayUID(cfg))
	fmt.Println("╚══════════════════════════════════════════════════════════╝")
	fmt.Println()
	printConnectionQRCode(cfg.WebhookURL, cfg.UID)

	// Open /dev/null for both stdout and stderr (no logging in release mode)
	devNull, err := os.Open(os.DevNull)
	if err != nil {
		log.Fatalf("Failed to open %s: %v", os.DevNull, err)
	}
	defer devNull.Close()

	// Re-exec self as daemon
	exe, err := os.Executable()
	if err != nil {
		log.Fatalf("Failed to get executable path: %v", err)
	}

	p, err := os.StartProcess(exe, []string{exe, "run"}, &os.ProcAttr{
		Files: []*os.File{devNull, devNull, devNull}, // stdin, stdout, stderr all go to /dev/null
		Sys:   daemonSysProcAttr(),
	})
	if err != nil {
		log.Fatalf("Failed to start daemon: %v", err)
	}

	pid := p.Pid

	// Write PID file
	if err := os.WriteFile(pidPath, []byte(strconv.Itoa(pid)), 0644); err != nil {
		p.Kill()
		log.Fatalf("Failed to write PID file: %v", err)
	}

	p.Release()
	fmt.Printf("Started (PID %d), logging disabled in release mode\n", pid)
}

// cmdRunRelease runs the bridge without any logging (release build)
func cmdRunRelease() {
	// Disable all logging in release mode
	log.SetOutput(os.Stderr)
	log.SetFlags(0)

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[Main] Failed to load config: %v", err)
	}

	// ==========================================
	// DISPLAY BRIDGE UID (prominently)
	// ==========================================
	fmt.Println()
	fmt.Println("╔══════════════════════════════════════════════════════════╗")
	fmt.Printf("║  %-50s                                         ║\n", config.GetDisplayUID(cfg))
	fmt.Println("╚══════════════════════════════════════════════════════════╝")
	fmt.Println()
	printConnectionQRCode(cfg.WebhookURL, cfg.UID)

	// Create OpenClaw client
	clawdbotClient := openclaw.NewClient(
		cfg.OpenClaw.GatewayPort,
		cfg.OpenClaw.GatewayToken,
		cfg.OpenClaw.AgentID,
	)

	// Create session store
	sessionStore := sessions.NewStore(sessions.DefaultStoreConfig(cfg.SessionStorePath))

	// Create bridge
	bridgeInstance := bridge.NewBridge(nil, clawdbotClient)
	bridgeInstance.SetUID(cfg.UID)               // Set UID for message routing
	bridgeInstance.SetSessionStore(sessionStore) // Configure session store

	// Set session scope from config
	var scope sessions.SessionScope
	switch cfg.SessionScope {
	case "global":
		scope = sessions.SessionScopeGlobal
	case "per-sender":
		fallthrough
	default:
		scope = sessions.SessionScopePerSender
	}
	bridgeInstance.SetSessionScope(scope)

	// Set OpenClaw event callback to forward to webhook
	clawdbotClient.SetEventCallback(bridgeInstance.HandleOpenClawEvent)

	// Create webhook client with bridge message handler
	webhookClient := webhook.NewClient(
		cfg.WebhookURL,
		bridgeInstance.HandleWebhookMessage,
		cfg.UID, // Pass UID for message identification
	)

	// Set webhook client on bridge
	bridgeInstance.SetWebhookClient(webhookClient)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start OpenClaw persistent connection
	if err := clawdbotClient.Connect(ctx); err != nil {
		log.Fatalf("[Main] Failed to connect to OpenClaw Gateway: %v", err)
	}
	defer clawdbotClient.Close()

	// Start Webhook persistent connection
	if err := webhookClient.Connect(ctx); err != nil {
		log.Fatalf("[Main] Failed to connect to Webhook server: %v", err)
	}
	defer webhookClient.Close()

	// Make sure to close connections on shutdown
	go func() {
		<-ctx.Done()
		webhookClient.Close()
		clawdbotClient.Close()
	}()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	fmt.Println("OpenClaw Bridge started successfully (release mode - no logging)")
	fmt.Println("Press Ctrl+C to stop")

	select {
	case <-sigChan:
		fmt.Println("\nShutting down...")
		cancel()
	}
}

func cmdStop() {
	dir, err := config.Dir()
	if err != nil {
		log.Fatal(err)
	}

	pidPath := filepath.Join(dir, "bridge.pid")
	pid, err := readPID(pidPath)
	if err != nil {
		fmt.Println("Not running")
		os.Exit(1)
	}

	if err := stopProcess(pid); err != nil {
		fmt.Println("Not running")
		os.Remove(pidPath)
		os.Exit(1)
	}

	for i := 0; i < 10; i++ {
		time.Sleep(200 * time.Millisecond)
		if !isProcessRunning(pid) {
			break
		}
	}

	os.Remove(pidPath)
	fmt.Println("Stopped")
}

func cmdStatus() {
	dir, err := config.Dir()
	if err != nil {
		log.Fatal(err)
	}

	pidPath := filepath.Join(dir, "bridge.pid")
	if isRunning(pidPath) {
		pid, _ := readPID(pidPath)
		fmt.Printf("Running (PID %d)\n", pid)
	} else {
		fmt.Println("Not running")
		os.Exit(1)
	}
}

// Helper functions
func isRunning(pidPath string) bool {
	pid, err := readPID(pidPath)
	if err != nil {
		return false
	}
	return isProcessRunning(pid)
}

func readPID(pidPath string) (int, error) {
	data, err := os.ReadFile(pidPath)
	if err != nil {
		return 0, err
	}
	return strconv.Atoi(strings.TrimSpace(string(data)))
}

func applyConfigArgs(args []string) {
	kv := parseKeyValue(args)
	webhookURL := kv["webhook_url"]
	uid := kv["uid"]

	dir, err := config.Dir()
	if err != nil {
		log.Fatal(err)
	}

	// Read existing config if present to use as defaults
	var cfg bridgeConfigJSON
	defaultWebhookURL := ""
	defaultUID := ""
	if data, err := os.ReadFile(filepath.Join(dir, "bridge.json")); err == nil {
		json.Unmarshal(data, &cfg)
		defaultWebhookURL = cfg.WebhookURL
		if cfg.UID != "" {
			defaultUID = cfg.UID
		} else {
			defaultUID = cfg.AgentID // Using agent_id field as uid for compatibility
		}
	}

	// If no webhook_url provided, prompt for it with default value
	if webhookURL == "" {
		reader := bufio.NewReader(os.Stdin)
		if defaultWebhookURL != "" {
			fmt.Printf("Enter WebSocket URL [%s]: ", defaultWebhookURL)
		} else {
			fmt.Print("Enter WebSocket URL (e.g., ws://localhost:8080/ws): ")
		}
		input, _ := reader.ReadString('\n')
		webhookURL = strings.TrimSpace(input)
		if webhookURL == "" && defaultWebhookURL != "" {
			webhookURL = defaultWebhookURL
		}
		if webhookURL == "" {
			log.Fatal("webhook_url is required")
		}
	}

	// If no uid provided, prompt for it with default value
	if uid == "" {
		reader := bufio.NewReader(os.Stdin)
		if defaultUID != "" {
			fmt.Printf("Enter UID [%s]: ", defaultUID)
		} else {
			fmt.Print("Enter UID (optional, press Enter to skip): ")
		}
		input, _ := reader.ReadString('\n')
		uid = strings.TrimSpace(input)
		if uid == "" {
			uid = defaultUID
		}
		if uid == "" {
			uid = generateUID()
		}
	}

	cfg.WebhookURL = webhookURL
	cfg.UID = uid

	data, _ := json.MarshalIndent(cfg, "", "  ")
	path := filepath.Join(dir, "bridge.json")
	if err := os.WriteFile(path, data, 0600); err != nil {
		log.Fatalf("Failed to save config: %v", err)
	}
	fmt.Printf("Saved config to %s\n", path)
}

type bridgeConfigJSON struct {
	WebhookURL string `json:"webhook_url"`
	AgentID    string `json:"agent_id,omitempty"`
	UID        string `json:"uid,omitempty"`
}

func generateUID() string {
	return uuid.NewString()
}

func printConnectionQRCode(webhookURL, uid string) {
	if webhookURL == "" || uid == "" {
		return
	}

	payloadBytes, err := json.Marshal(map[string]string{
		"wsUrl": webhookURL,
		"uid":   uid,
	})
	if err != nil {
		log.Printf("[Main] Failed to build QR payload: %v", err)
		return
	}
	payload := string(payloadBytes)

	fmt.Println("Scan this QR with openclaw-mapp to connect:")
	renderQRCode(payload)
	fmt.Printf("QR payload: %s\n\n", payload)
}

func renderQRCode(payload string) {
	qr, err := qrcode.New(payload, qrcode.Medium)
	if err != nil {
		log.Printf("[Main] Failed to generate QR: %v", err)
		return
	}
	bitmap := qr.Bitmap()
	if len(bitmap) == 0 || len(bitmap[0]) == 0 {
		return
	}

	const border = 1
	const upper = "▀"
	const lower = "▄"
	const full = "█"
	const empty = " "

	for y := -border; y < len(bitmap)+border; y += 2 {
		var line strings.Builder
		for x := -border; x < len(bitmap[0])+border; x++ {
			top := false
			bottom := false
			if y >= 0 && y < len(bitmap) && x >= 0 && x < len(bitmap[0]) {
				top = bitmap[y][x]
			}
			if y+1 >= 0 && y+1 < len(bitmap) && x >= 0 && x < len(bitmap[0]) {
				bottom = bitmap[y+1][x]
			}

			switch {
			case top && bottom:
				line.WriteString(full)
			case top && !bottom:
				line.WriteString(upper)
			case !top && bottom:
				line.WriteString(lower)
			default:
				line.WriteString(empty)
			}
		}
		fmt.Println(line.String())
	}
}

func parseKeyValue(args []string) map[string]string {
	result := make(map[string]string)
	for _, arg := range args {
		if parts := strings.SplitN(arg, "=", 2); len(parts) == 2 {
			result[parts[0]] = parts[1]
		}
	}
	return result
}
