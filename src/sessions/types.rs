use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Session scope defines how sessions are scoped
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SessionScope {
    #[serde(rename = "per-sender")]
    PerSender,
    #[serde(rename = "global")]
    Global,
}

impl std::fmt::Display for SessionScope {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionScope::PerSender => write!(f, "per-sender"),
            SessionScope::Global => write!(f, "global"),
        }
    }
}

/// Session entry represents a stored session with its state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionEntry {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(skip_serializing_if = "Option::is_none", rename = "sessionFile")]
    pub session_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "deliveryContext")]
    pub delivery_context: Option<DeliveryContext>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "lastChannel")]
    pub last_channel: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "lastTo")]
    pub last_to: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "lastAccountId")]
    pub last_account_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "lastThreadId")]
    pub last_thread_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "webhookMessageId")]
    pub webhook_message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "webhookSessionId")]
    pub webhook_session_id: Option<String>,
}

/// Delivery context contains information needed to route responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryContext {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "accountId")]
    pub account_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "threadId")]
    pub thread_id: Option<String>,
}

/// Session store type
pub type SessionStore = HashMap<String, SessionEntry>;

/// Default reset triggers for sessions
pub const DEFAULT_RESET_TRIGGERS: &[&str] = &["/new", "/reset"];

/// Generate a new session ID
pub fn generate_session_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Get current timestamp in milliseconds
pub fn current_timestamp() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

/// Normalize a session key
pub fn normalize_session_key(key: &str) -> String {
    key.trim().to_string()
}

/// Webhook message structure for session key resolution
#[derive(Debug)]
pub struct WebhookMessage {
    pub id: String,
    pub content: String,
    pub session: Option<String>,
}

/// Resolve session key based on scope
pub fn resolve_session_key(scope: &SessionScope, msg: &WebhookMessage) -> String {
    match scope {
        SessionScope::Global => "global".to_string(),
        SessionScope::PerSender => format!("webhook:{}", msg.id),
    }
}

/// Webhook session parameters
#[derive(Debug)]
pub struct WebhookSessionParams {
    pub agent_id: String,
    pub peer_kind: String,
    pub peer_id: String,
    pub topic_id: Option<String>,
    pub thread_id: Option<String>,
}

/// Build webhook session key from parameters
pub fn build_webhook_session_key(params: &WebhookSessionParams) -> Option<String> {
    if params.peer_kind.is_empty() || params.peer_id.is_empty() {
        return None;
    }
    
    let mut key = format!("webhook:{}:{}:{}", params.agent_id, params.peer_kind, params.peer_id);
    
    if let Some(ref topic_id) = params.topic_id {
        if !topic_id.is_empty() {
            key.push_str(&format!(":{}", topic_id));
        }
    }
    
    if let Some(ref thread_id) = params.thread_id {
        if !thread_id.is_empty() {
            key.push_str(&format!(":{}", thread_id));
        }
    }
    
    Some(key)
}

/// Session control message types
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ControlMessageType {
    SessionGet,
    SessionList,
    SessionReset,
    SessionDelete,
}

/// Session control message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionControlMessage {
    #[serde(rename = "type")]
    pub msg_type: ControlMessageType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}

/// Session info response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfoResponse {
    pub key: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(skip_serializing_if = "Option::is_none", rename = "deliveryContext")]
    pub delivery_context: Option<DeliveryContext>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "lastChannel")]
    pub last_channel: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "lastTo")]
    pub last_to: Option<String>,
}

/// Session list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionListResponse {
    pub sessions: Vec<SessionInfoResponse>,
    pub count: usize,
}

/// Check if a message is a session control message
pub fn is_session_control_message(data: &[u8]) -> bool {
    if let Ok(msg) = serde_json::from_slice::<serde_json::Value>(data) {
        if let Some(msg_type) = msg.get("type") {
            if let Some(type_str) = msg_type.as_str() {
                return matches!(
                    type_str,
                    "session.get" | "session.list" | "session.reset" | "session.delete"
                );
            }
        }
    }
    false
}

/// Parse session control message
pub fn parse_session_control_message(data: &[u8]) -> anyhow::Result<SessionControlMessage> {
    Ok(serde_json::from_slice(data)?)
}

/// Build session control response
pub fn build_session_control_response(
    msg_type: &ControlMessageType,
    data: &impl Serialize,
) -> anyhow::Result<Vec<u8>> {
    let mut response = serde_json::to_value(data)?;
    if let Some(obj) = response.as_object_mut() {
        obj.insert("type".to_string(), serde_json::json!(msg_type));
    }
    Ok(serde_json::to_vec(&response)?)
}
