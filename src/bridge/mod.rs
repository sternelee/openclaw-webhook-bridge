use anyhow::Result;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::commands::{self, CommandHandler};
use crate::openclaw;
use crate::sessions::{self, DeliveryContext, SessionScope, Store as SessionStore};
use crate::webhook;

/// Webhook message structure
#[derive(Debug, Deserialize)]
pub struct WebhookMessage {
    pub id: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session: Option<String>,
    #[serde(rename = "peerKind", skip_serializing_if = "Option::is_none")]
    pub peer_kind: Option<String>,
    #[serde(rename = "peerId", skip_serializing_if = "Option::is_none")]
    pub peer_id: Option<String>,
    #[serde(rename = "chatType", skip_serializing_if = "Option::is_none")]
    pub chat_type: Option<String>,
    #[serde(rename = "chatId", skip_serializing_if = "Option::is_none")]
    pub chat_id: Option<String>,
    #[serde(rename = "senderId", skip_serializing_if = "Option::is_none")]
    pub sender_id: Option<String>,
    #[serde(rename = "topicId", skip_serializing_if = "Option::is_none")]
    pub topic_id: Option<String>,
    #[serde(rename = "threadId", skip_serializing_if = "Option::is_none")]
    pub thread_id: Option<String>,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub msg_type: Option<String>,
}

/// Bridge connects webhook and OpenClaw
pub struct Bridge {
    webhook_client: Arc<RwLock<Option<webhook::Client>>>,
    openclaw_client: Arc<RwLock<Option<openclaw::Client>>>,
    command_handler: CommandHandler,
    agent_id: String,
    uid: String,
    session_store: Option<Arc<SessionStore>>,
    session_scope: SessionScope,
}

impl Bridge {
    pub fn new(agent_id: String) -> Self {
        Self {
            webhook_client: Arc::new(RwLock::new(None)),
            openclaw_client: Arc::new(RwLock::new(None)),
            command_handler: CommandHandler::new(),
            agent_id,
            uid: String::new(),
            session_store: None,
            session_scope: SessionScope::PerSender,
        }
    }

    pub fn set_uid(&mut self, uid: String) {
        info!("[Bridge] Bridge UID set to: {}", uid);
        self.uid = uid;
    }

    pub fn set_session_store(&mut self, store: Arc<SessionStore>) {
        info!("[Bridge] Session store configured");
        self.session_store = Some(store);
    }

    pub fn set_session_scope(&mut self, scope: SessionScope) {
        info!("[Bridge] Session scope set to: {}", scope);
        self.session_scope = scope;
    }

    pub async fn set_webhook_client(&self, client: webhook::Client) {
        let mut w = self.webhook_client.write().await;
        *w = Some(client);
    }

    pub async fn set_openclaw_client(&self, client: openclaw::Client) {
        let mut o = self.openclaw_client.write().await;
        *o = Some(client);
    }

    /// Handle message from webhook
    pub async fn handle_webhook_message(&self, data: Vec<u8>) -> Result<()> {
        info!("[Bridge] Webhook -> OpenClaw: {} bytes", data.len());

        // Check for session control messages
        if sessions::is_session_control_message(&data) {
            return self.handle_session_control_message(&data).await;
        }

        // Parse the message
        let msg: WebhookMessage = match serde_json::from_slice(&data) {
            Ok(m) => m,
            Err(e) => {
                warn!("[Bridge] Failed to parse webhook message: {}", e);
                return Ok(());
            }
        };

        // Skip control messages
        if let Some(ref msg_type) = msg.msg_type {
            if matches!(msg_type.as_str(), "connected" | "error" | "event") {
                info!("[Bridge] Skipping control message: type={}", msg_type);
                return Ok(());
            }
        }

        // Skip empty messages
        if msg.content.is_empty() {
            info!("[Bridge] Skipping empty message");
            return Ok(());
        }

        // Check if this is a command
        if commands::is_command(&msg.content) {
            return self.handle_command(&msg).await;
        }

        // Resolve session key
        let session_key = self.resolve_session_key(&msg);
        info!("[Bridge] Resolved session key: {} (scope: {})", session_key, self.session_scope);

        // Check for reset triggers
        let is_reset = self.is_reset_trigger(&msg.content);
        let content = if is_reset {
            info!("[Bridge] Reset trigger detected");
            self.strip_reset_trigger(&msg.content)
        } else {
            msg.content.clone()
        };

        // Record session metadata
        if let Some(ref store) = self.session_store {
            let delivery_to = msg.peer_id.clone().unwrap_or_else(|| msg.id.clone());
            let delivery_ctx = DeliveryContext {
                channel: Some("webhook".to_string()),
                to: Some(delivery_to),
                account_id: Some(self.uid.clone()),
                thread_id: self.resolve_delivery_thread_id(&msg),
            };

            // Reset session if triggered
            if is_reset {
                if let Err(e) = store.update_entry(&session_key, |_existing| {
                    Ok(sessions::SessionEntry {
                        session_id: sessions::generate_session_id(),
                        updated_at: sessions::current_timestamp(),
                        session_file: None,
                        delivery_context: None,
                        last_channel: None,
                        last_to: None,
                        last_account_id: None,
                        last_thread_id: None,
                        webhook_message_id: None,
                        webhook_session_id: None,
                    })
                }) {
                    warn!("[Bridge] Failed to reset session: {}", e);
                } else {
                    info!("[Bridge] Session reset successfully");
                }
            }

            // Record metadata
            if let Err(e) = store.record_inbound_meta(&session_key, &msg.id, &delivery_ctx) {
                warn!("[Bridge] Failed to record session metadata: {}", e);
            }
        }

        // Forward to OpenClaw
        let openclaw = self.openclaw_client.read().await;
        if let Some(ref client) = *openclaw {
            client.send_agent_request(&content, &session_key).await?;
        } else {
            warn!("[Bridge] OpenClaw client not initialized");
        }

        Ok(())
    }

    /// Handle OpenClaw event
    pub async fn handle_openclaw_event(&self, data: Vec<u8>) {
        info!("[Bridge] OpenClaw -> Webhook: {} bytes", data.len());

        // Parse event to check type
        let event: serde_json::Value = match serde_json::from_slice(&data) {
            Ok(e) => e,
            Err(e) => {
                warn!("[Bridge] Failed to parse event: {}", e);
                self.send_to_webhook(data).await;
                return;
            }
        };

        // Skip internal lifecycle events
        if let Some(event_type) = event.get("event").and_then(|v| v.as_str()) {
            if matches!(event_type, "lifecycle" | "tick" | "presence" | "health") {
                return;
            }
        }

        // Convert to webhook format
        if let Some(converted) = self.convert_event_to_webhook_format(&event) {
            self.send_to_webhook(converted).await;
        }
    }

    /// Convert OpenClaw event to webhook format
    fn convert_event_to_webhook_format(&self, event: &serde_json::Value) -> Option<Vec<u8>> {
        let event_type = event.get("type")?.as_str()?;

        match event_type {
            "agent" => {
                let stream = event.get("stream")?.as_str()?;
                let session_key = event.get("sessionKey")?.as_str()?;

                match stream {
                    "lifecycle" => {
                        let phase = event.get("data")?.get("phase")?.as_str()?;
                        if matches!(phase, "end" | "complete") {
                            let response = json!({
                                "type": "complete",
                                "content": "",
                                "session": session_key,
                            });
                            return serde_json::to_vec(&response).ok();
                        }
                        None
                    }
                    "assistant" => {
                        let text = event.get("data")?.get("text")?.as_str()?;
                        if !text.is_empty() {
                            let response = json!({
                                "type": "progress",
                                "content": text,
                                "session": session_key,
                            });
                            return serde_json::to_vec(&response).ok();
                        }
                        None
                    }
                    "tool" => None, // Skip tool stream
                    _ => None,
                }
            }
            "chat" => {
                let state = event.get("state")?.as_str()?;
                let session_key = event.get("sessionKey")?.as_str()?;

                // Extract text from content array
                let mut text = String::new();
                if let Some(message) = event.get("message") {
                    if let Some(content) = message.get("content").and_then(|v| v.as_array()) {
                        for item in content {
                            if item.get("type")?.as_str()? == "text" {
                                if let Some(t) = item.get("text").and_then(|v| v.as_str()) {
                                    text.push_str(t);
                                }
                            }
                        }
                    }
                }

                match state {
                    "final" => {
                        let response = json!({
                            "type": "complete",
                            "content": text,
                            "session": session_key,
                        });
                        serde_json::to_vec(&response).ok()
                    }
                    "delta" if !text.is_empty() => {
                        let response = json!({
                            "type": "progress",
                            "content": text,
                            "session": session_key,
                        });
                        serde_json::to_vec(&response).ok()
                    }
                    "error" => {
                        let response = json!({
                            "type": "error",
                            "content": "An error occurred",
                            "session": session_key,
                        });
                        serde_json::to_vec(&response).ok()
                    }
                    _ => None,
                }
            }
            _ => serde_json::to_vec(event).ok(),
        }
    }

    /// Send data to webhook
    async fn send_to_webhook(&self, data: Vec<u8>) {
        let webhook = self.webhook_client.read().await;
        if let Some(ref client) = *webhook {
            if let Err(e) = client.send(data).await {
                warn!("[Bridge] Failed to send to webhook: {}", e);
            }
        }
    }

    /// Resolve session key
    fn resolve_session_key(&self, msg: &WebhookMessage) -> String {
        // Use explicit session if provided
        if let Some(ref session) = msg.session {
            return sessions::normalize_session_key(session);
        }

        // Try to build from peer info
        let peer_kind = Self::coalesce_string(&[
            msg.peer_kind.as_deref(),
            msg.chat_type.as_deref(),
        ]);
        let peer_id = Self::coalesce_string(&[
            msg.peer_id.as_deref(),
            msg.chat_id.as_deref(),
            msg.sender_id.as_deref(),
        ]);

        if let (Some(kind), Some(id)) = (peer_kind, peer_id) {
            if let Some(key) = sessions::build_webhook_session_key(&sessions::WebhookSessionParams {
                agent_id: self.agent_id.clone(),
                peer_kind: kind.to_string(),
                peer_id: id.to_string(),
                topic_id: msg.topic_id.clone(),
                thread_id: msg.thread_id.clone(),
            }) {
                return key;
            }
        }

        // Fallback to scope-based resolution
        let webhook_msg = sessions::WebhookMessage {
            id: msg.id.clone(),
            content: msg.content.clone(),
            session: msg.session.clone(),
        };
        sessions::resolve_session_key(&self.session_scope, &webhook_msg)
    }

    /// Helper to get first non-empty string
    fn coalesce_string(values: &[Option<&str>]) -> Option<String> {
        for val in values {
            if let Some(v) = val {
                let trimmed = v.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
        None
    }

    /// Resolve delivery thread ID
    fn resolve_delivery_thread_id(&self, msg: &WebhookMessage) -> Option<String> {
        let peer_kind = msg.peer_kind.as_deref().or(msg.chat_type.as_deref())?;

        match peer_kind {
            "dm" => msg.thread_id.clone(),
            "group" | "channel" => {
                msg.topic_id.clone().or_else(|| msg.thread_id.clone())
            }
            _ => None,
        }
    }

    /// Check if content is a reset trigger
    fn is_reset_trigger(&self, content: &str) -> bool {
        let trimmed = content.trim();
        sessions::DEFAULT_RESET_TRIGGERS.iter().any(|&trigger| trimmed == trigger)
    }

    /// Strip reset trigger from content
    fn strip_reset_trigger(&self, content: &str) -> String {
        let trimmed = content.trim();
        for &trigger in sessions::DEFAULT_RESET_TRIGGERS {
            if trimmed == trigger {
                return String::new();
            }
            if trimmed.starts_with(trigger) && trimmed.len() > trigger.len() {
                if trimmed.chars().nth(trigger.len()) == Some(' ') {
                    return trimmed[trigger.len() + 1..].trim().to_string();
                }
            }
        }
        content.to_string()
    }

    /// Handle command
    async fn handle_command(&self, msg: &WebhookMessage) -> Result<()> {
        info!("[Bridge] Processing command: {}", msg.content);

        let response = match self.command_handler.handle_command(&msg.content) {
            Ok(resp) => resp,
            Err(e) => {
                let err_str = e.to_string();
                if err_str.starts_with("FORWARD_TO_GATEWAY:") {
                    // Forward to gateway
                    let forward_content = &err_str["FORWARD_TO_GATEWAY:".len()..];
                    info!("[Bridge] Forwarding to Gateway: {}", forward_content);

                    let session_key = msg.session.as_deref().unwrap_or("global");
                    let openclaw = self.openclaw_client.read().await;
                    if let Some(ref client) = *openclaw {
                        client.send_agent_request(forward_content, session_key).await?;
                    }
                    return Ok(());
                }

                format!("Error: {}", e)
            }
        };

        // Send response back to webhook
        let response_data = commands::format_command_response(
            &response,
            msg.session.as_deref().unwrap_or("global"),
        )?;

        self.send_to_webhook(response_data).await;
        Ok(())
    }

    /// Handle session control message
    async fn handle_session_control_message(&self, _data: &[u8]) -> Result<()> {
        info!("[Bridge] Session control message handling not yet fully implemented");
        // TODO: Implement full session control
        Ok(())
    }
}
