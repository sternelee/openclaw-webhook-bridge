package commands

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/sternelee/openclaw-webhook-bridge/internal/openclaw"
)

// CommandHandler handles slash commands from webhook messages
type CommandHandler struct {
	gatewayClient GatewayClient
}

// GatewayClient interface for OpenClaw Gateway communication
type GatewayClient interface {
	ListSkills() ([]openclaw.SkillInfo, error)
	ListCommands() ([]openclaw.CommandInfo, error)
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
	// Return static command list instead of querying Gateway
	var response strings.Builder
	response.WriteString("**Available Commands:**\n\n")

	response.WriteString("**📊 Status**\n")
	response.WriteString("  /help - Show this help message\n")
	response.WriteString("  /commands - List all available commands\n")
	response.WriteString("  /status - Show current connection status\n\n")

	response.WriteString("**🛠️ Tools**\n")
	response.WriteString("  /skill - List all available skills\n")
	response.WriteString("  /skill <name> [args] - Run a specific skill\n\n")

	response.WriteString("**⚙️ Management**\n")
	response.WriteString("  /approve <id> [yes|no] - Approve or deny execution requests\n\n")

	return response.String(), nil
}

// handleSkill lists skills or runs a specific skill
func (h *CommandHandler) handleSkill(args string) (string, error) {
	// If no args provided, list all skills
	if args == "" {
		return h.listSkills()
	}

	// If args provided, return a message indicating the skill request will be forwarded
	// The actual execution should be handled by forwarding to OpenClaw Gateway
	return "", fmt.Errorf("FORWARD_TO_GATEWAY:/skill %s", args)
}

// listSkills returns a list of available skills
func (h *CommandHandler) listSkills() (string, error) {
	// Return static skill list for common OpenClaw skills
	var response strings.Builder
	response.WriteString("**Available Skills:**\n\n")

	// Common OpenClaw skills
	skills := []struct {
		name        string
		description string
	}{
		{"web-search", "Search the web for information"},
		{"read-file", "Read and analyze file contents"},
		{"write-file", "Create or modify files"},
		{"bash", "Execute shell commands"},
		{"ask-human", "Ask the user for clarification"},
	}

	for _, skill := range skills {
		response.WriteString(fmt.Sprintf("🔧 **%s**\n", skill.name))
		response.WriteString(fmt.Sprintf("   %s\n", skill.description))
		response.WriteString(fmt.Sprintf("   Usage: `/skill %s [args]`\n\n", skill.name))
	}

	response.WriteString("💡 **Tip**: Use `/skill <name> <args>` to run a skill\n")
	response.WriteString("   Example: `/skill web-search OpenClaw AI`\n")

	return response.String(), nil
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
