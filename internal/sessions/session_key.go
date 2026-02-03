package sessions

import (
	"fmt"
	"strings"
)

const (
	// DefaultAgentID is the default agent ID
	DefaultAgentID = "main"
	// DefaultMainKey is the default main session key
	DefaultMainKey = "main"
)

// WebhookMessage represents an incoming webhook message
type WebhookMessage struct {
	ID      string
	Content string
	Session string
}

// ResolveSessionKey resolves the session key for a webhook message
// Following OpenClaw's pattern:
// - If an explicit session is provided in the message, use it
// - For per-sender scope, use webhook:{id} pattern
// - For global scope, use "global"
func ResolveSessionKey(scope SessionScope, msg *WebhookMessage) string {
	// Check for explicit session key in the message
	if msg.Session != "" {
		return strings.ToLower(strings.TrimSpace(msg.Session))
	}

	switch scope {
	case SessionScopeGlobal:
		return "global"
	case SessionScopePerSender:
		fallthrough
	default:
		// Use webhook:{id} pattern for individual message sessions
		// This allows each webhook message to have its own conversation context
		if msg.ID != "" {
			return fmt.Sprintf("webhook:%s", msg.ID)
		}
		// Fallback to a default key
		return fmt.Sprintf("agent:%s:%s", DefaultAgentID, DefaultMainKey)
	}
}

// BuildAgentMainSessionKey builds the canonical main session key
func BuildAgentMainSessionKey(agentID, mainKey string) string {
	if mainKey == "" {
		mainKey = DefaultMainKey
	}
	if agentID == "" {
		agentID = DefaultAgentID
	}
	return fmt.Sprintf("agent:%s:%s", agentID, mainKey)
}

// IsGroupSessionKey checks if a session key represents a group/chat session
func IsGroupSessionKey(sessionKey string) bool {
	return strings.Contains(sessionKey, ":group:") ||
		strings.Contains(sessionKey, ":channel:")
}

// ShouldCollapseToMain checks if a session should collapse to the main session
// (non-group sessions collapse to main for continuity)
func ShouldCollapseToMain(sessionKey string) bool {
	return !IsGroupSessionKey(sessionKey)
}

// ParseSessionKey parses a session key to extract its components
// Returns (agentID, sessionType, identifier)
func ParseSessionKey(sessionKey string) (agentID, sessionType, identifier string) {
	parts := strings.Split(sessionKey, ":")
	if len(parts) >= 3 && parts[0] == "agent" {
		return parts[1], parts[2], strings.Join(parts[3:], ":")
	}
	if len(parts) >= 2 && parts[0] == "webhook" {
		return DefaultAgentID, "webhook", parts[1]
	}
	return "", "", ""
}

// NormalizeSessionKey normalizes a session key to lowercase and trimmed
func NormalizeSessionKey(sessionKey string) string {
	return strings.ToLower(strings.TrimSpace(sessionKey))
}
