use anyhow::Result;
use serde_json::json;

/// Check if a message content is a command
pub fn is_command(content: &str) -> bool {
    content.trim().starts_with('/')
}

/// Format a command response
pub fn format_command_response(response: &str, session: &str) -> Result<Vec<u8>> {
    let msg = json!({
        "type": "complete",
        "content": response,
        "session": session,
    });
    Ok(serde_json::to_vec(&msg)?)
}

/// Command handler
pub struct CommandHandler {
    // Future: add gateway client reference if needed
}

impl CommandHandler {
    pub fn new() -> Self {
        Self {}
    }

    /// Handle a command and return the response
    pub fn handle_command(&self, content: &str) -> Result<String> {
        let trimmed = content.trim();

        // Check for gateway commands that should be forwarded
        if self.should_forward_to_gateway(trimmed) {
            // Return a special error that signals forwarding
            anyhow::bail!("FORWARD_TO_GATEWAY:{}", trimmed);
        }

        // Handle local commands
        match trimmed {
            "/help" => Ok(self.handle_help()),
            "/version" => Ok(self.handle_version()),
            _ => Ok(format!("Unknown command: {}. Type /help for available commands.", trimmed)),
        }
    }

    /// Check if command should be forwarded to gateway
    fn should_forward_to_gateway(&self, content: &str) -> bool {
        // Most commands should be forwarded to the gateway
        // Only handle a few locally
        !matches!(content, "/help" | "/version")
    }

    /// Handle help command
    fn handle_help(&self) -> String {
        r#"Available commands:
/help - Show this help message
/version - Show bridge version
/new - Start a new conversation (forwarded to gateway)
/reset - Reset current conversation (forwarded to gateway)

Most other commands are forwarded to the OpenClaw Gateway."#.to_string()
    }

    /// Handle version command
    fn handle_version(&self) -> String {
        format!(
            "OpenClaw Bridge Rust v{} (Rust implementation)",
            env!("CARGO_PKG_VERSION")
        )
    }
}

impl Default for CommandHandler {
    fn default() -> Self {
        Self::new()
    }
}
