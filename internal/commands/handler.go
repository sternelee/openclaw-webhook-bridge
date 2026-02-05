package commands

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
)

// CommandHandler handles slash commands from webhook messages
type CommandHandler struct {
	gatewayClient GatewayClient
}

// GatewayClient interface for OpenClaw Gateway communication
type GatewayClient interface {
	SendApproval(requestID string, approved bool) error
}

// NewCommandHandler creates a new command handler
func NewCommandHandler(gateway GatewayClient) *CommandHandler {
	return &CommandHandler{
		gatewayClient: gateway,
	}
}

// IsCommand checks if a message starts with a slash command
func IsCommand(message string) bool {
	trimmed := strings.TrimSpace(message)
	return strings.HasPrefix(trimmed, "/")
}

// ParseCommand extracts the command name and arguments
func ParseCommand(message string) (command string, args string) {
	trimmed := strings.TrimSpace(message)
	if !strings.HasPrefix(trimmed, "/") {
		return "", ""
	}

	// Remove leading slash
	withoutSlash := trimmed[1:]

	// Split into command and args
	parts := strings.SplitN(withoutSlash, " ", 2)
	command = strings.ToLower(parts[0])

	if len(parts) > 1 {
		args = strings.TrimSpace(parts[1])
	}

	return command, args
}

// HandleCommand processes a slash command and returns a response
func (h *CommandHandler) HandleCommand(message string) (string, error) {
	command, args := ParseCommand(message)

	log.Printf("[Commands] Processing command: /%s args: %s", command, args)

	switch command {
	case "help":
		return h.handleHelp()
	case "commands":
		return h.handleCommands()
	case "skill", "skills":
		return h.handleSkill(args)
	case "approve":
		return h.handleApprove(args)
	default:
		return "", fmt.Errorf("unknown command: /%s", command)
	}
}

// handleHelp returns help information
func (h *CommandHandler) handleHelp() (string, error) {
	helpText := `**Available Commands:**

🔹 **/help** - Show this help message
🔹 **/commands** - List all available commands
🔹 **/skill [name]** - List skills or run a specific skill
🔹 **/approve [id]** - Approve or deny pending requests

💡 Use /commands to see the full command list
💡 Use /skill to see all available skills`

	return helpText, nil
}

// handleCommands lists all available commands
func (h *CommandHandler) handleCommands() (string, error) {
	// Forward to OpenClaw Gateway for processing
	// The Gateway will handle /commands internally via its auto-reply system
	return "", fmt.Errorf("FORWARD_TO_GATEWAY:/commands")
}

// handleSkill lists skills or runs a specific skill
func (h *CommandHandler) handleSkill(args string) (string, error) {
	// Forward all /skill commands to OpenClaw Gateway for processing
	// The Gateway will handle /skill internally via its auto-reply system
	if args == "" {
		return "", fmt.Errorf("FORWARD_TO_GATEWAY:/skill")
	}
	return "", fmt.Errorf("FORWARD_TO_GATEWAY:/skill %s", args)
}

// handleApprove processes approval requests
func (h *CommandHandler) handleApprove(args string) (string, error) {
	if args == "" {
		return "Usage: /approve <request-id> [yes|no]", nil
	}

	parts := strings.Fields(args)
	if len(parts) < 1 {
		return "Usage: /approve <request-id> [yes|no]", nil
	}

	requestID := parts[0]
	approved := true // Default to approve

	if len(parts) > 1 {
		decision := strings.ToLower(parts[1])
		approved = decision == "yes" || decision == "y" || decision == "approve"
	}

	err := h.gatewayClient.SendApproval(requestID, approved)
	if err != nil {
		log.Printf("[Commands] Failed to send approval: %v", err)
		return "", fmt.Errorf("failed to send approval: %w", err)
	}

	status := "approved"
	if !approved {
		status = "denied"
	}

	return fmt.Sprintf("Request %s has been %s", requestID, status), nil
}

// FormatCommandResponse wraps a command response in the webhook message format
func FormatCommandResponse(content string, session string) ([]byte, error) {
	response := map[string]interface{}{
		"type":    "complete",
		"content": content,
		"session": session,
	}
	return json.Marshal(response)
}
