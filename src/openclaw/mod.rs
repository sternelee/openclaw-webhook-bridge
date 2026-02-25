use anyhow::{Context, Result};
use base64::Engine as _;
use ed25519_dalek::{Signer, SigningKey};
use futures_util::{SinkExt, StreamExt};
use log::{error, info};
use rand::rngs::OsRng;
use serde::Serialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Notify};
use tokio::time::sleep;
use tokio_tungstenite::{connect_async, tungstenite::Message};

type EventCallback = Arc<dyn Fn(Vec<u8>) + Send + Sync>;

/// Device identity for Gateway authentication
#[derive(Clone, Debug)]
struct DeviceIdentity {
    device_id: String,
    public_key: [u8; 32],
    private_key: [u8; 32],
}

/// Load or create device identity from config directory
fn load_or_create_device_identity(config_dir: &std::path::Path) -> Result<DeviceIdentity> {
    let identity_path = config_dir.join("identity.json");

    if identity_path.exists() {
        let content = std::fs::read_to_string(&identity_path)?;
        let stored: serde_json::Value =
            serde_json::from_str(&content).context("Failed to parse identity file")?;

        let device_id = stored["deviceId"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("missing deviceId"))?;
        let public_key_b64 = stored["publicKey"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("missing publicKey"))?;
        let private_key_b64 = stored["privateKey"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("missing privateKey"))?;

        let public_key = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(public_key_b64)
            .context("Invalid public key")?;
        let private_key = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(private_key_b64)
            .context("Invalid private key")?;

        if public_key.len() != 32 || private_key.len() != 32 {
            anyhow::bail!("Invalid key length");
        }

        let mut public_key_arr = [0u8; 32];
        let mut private_key_arr = [0u8; 32];
        public_key_arr.copy_from_slice(&public_key);
        private_key_arr.copy_from_slice(&private_key);

        // Verify device_id matches
        let computed_id = compute_device_id(&public_key_arr);
        if computed_id != device_id {
            anyhow::bail!("Device ID mismatch");
        }

        return Ok(DeviceIdentity {
            device_id: device_id.to_string(),
            public_key: public_key_arr,
            private_key: private_key_arr,
        });
    }

    // Generate new identity
    let signing_key = SigningKey::generate(&mut OsRng);
    let verifying_key = signing_key.verifying_key();

    let mut public_key_arr = [0u8; 32];
    let mut private_key_arr = [0u8; 32];
    public_key_arr.copy_from_slice(verifying_key.as_bytes());
    private_key_arr.copy_from_slice(signing_key.as_bytes());

    let device_id = compute_device_id(&public_key_arr);

    // Ensure directory exists
    if let Some(parent) = identity_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Save to file
    let stored = serde_json::json!({
        "version": 1,
        "deviceId": device_id,
        "publicKey": base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(public_key_arr),
        "privateKey": base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(private_key_arr),
        "createdAtMs": chrono::Utc::now().timestamp_millis()
    });

    std::fs::write(&identity_path, serde_json::to_string_pretty(&stored)?)?;
    info!("[OpenClaw] Generated new device identity: {}", device_id);

    Ok(DeviceIdentity {
        device_id,
        public_key: public_key_arr,
        private_key: private_key_arr,
    })
}

/// Compute device ID from public key (SHA256 hash)
fn compute_device_id(public_key: &[u8; 32]) -> String {
    let hash = Sha256::digest(public_key);
    hex::encode(hash)
}

/// Sign device auth payload
fn sign_device_payload(private_key: &[u8; 32], payload: &str) -> String {
    let signing_key = SigningKey::from_bytes(private_key);
    let signature = signing_key.sign(payload.as_bytes());
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(signature.to_bytes())
}

/// OpenClaw Gateway WebSocket client
pub struct Client {
    port: u16,
    token: String,
    agent_id: String,
    device_identity: DeviceIdentity,
    connected: Arc<AtomicBool>,
    conn_notify: Arc<Notify>,
    shutdown_tx: Option<mpsc::Sender<()>>,
    send_tx: Option<mpsc::Sender<Vec<u8>>>,
    on_event: Option<EventCallback>,
}

#[derive(Debug, Serialize)]
struct AgentRequest {
    #[serde(rename = "type")]
    msg_type: String,
    id: String,
    method: String,
    params: AgentRequestParams,
}

#[derive(Debug, Serialize)]
struct AgentRequestParams {
    message: String,
    #[serde(rename = "agentId")]
    agent_id: String,
    #[serde(rename = "sessionKey")]
    session_key: String,
    deliver: bool,
    #[serde(rename = "idempotencyKey")]
    idempotency_key: String,
}

impl Client {
    pub fn new(
        port: u16,
        token: String,
        agent_id: String,
        config_dir: &std::path::Path,
    ) -> Result<Self> {
        let device_identity = load_or_create_device_identity(config_dir)?;

        Ok(Self {
            port,
            token,
            agent_id,
            device_identity,
            connected: Arc::new(AtomicBool::new(false)),
            conn_notify: Arc::new(Notify::new()),
            shutdown_tx: None,
            send_tx: None,
            on_event: None,
        })
    }

    pub fn set_event_callback<F>(&mut self, callback: F)
    where
        F: Fn(Vec<u8>) + Send + Sync + 'static,
    {
        self.on_event = Some(Arc::new(callback));
    }

    /// Connect and start the connection loop
    pub async fn connect(&mut self) -> Result<()> {
        let (shutdown_tx, shutdown_rx) = mpsc::channel(1);
        let (send_tx, send_rx) = mpsc::channel(100);

        self.shutdown_tx = Some(shutdown_tx);
        self.send_tx = Some(send_tx);

        let port = self.port;
        let token = self.token.clone();
        let agent_id = self.agent_id.clone();
        let device_identity = self.device_identity.clone();
        let connected = Arc::clone(&self.connected);
        let conn_notify = Arc::clone(&self.conn_notify);
        let on_event = self.on_event.clone();

        // Spawn connection loop
        tokio::spawn(async move {
            Self::connection_loop(
                port,
                token,
                agent_id,
                device_identity,
                connected,
                conn_notify,
                shutdown_rx,
                send_rx,
                on_event,
            )
            .await;
        });

        // Wait for initial connection
        tokio::select! {
            _ = self.conn_notify.notified() => {
                if self.connected.load(Ordering::SeqCst) {
                    info!("[OpenClaw] Connected to gateway");
                    Ok(())
                } else {
                    anyhow::bail!("Failed to establish connection")
                }
            }
            _ = sleep(Duration::from_secs(5)) => {
                anyhow::bail!("Timeout connecting to gateway")
            }
        }
    }

    /// Connection loop with auto-reconnect
    #[allow(clippy::too_many_arguments)]
    async fn connection_loop(
        port: u16,
        token: String,
        agent_id: String,
        device_identity: DeviceIdentity,
        connected: Arc<AtomicBool>,
        conn_notify: Arc<Notify>,
        mut shutdown_rx: mpsc::Receiver<()>,
        mut send_rx: mpsc::Receiver<Vec<u8>>,
        on_event: Option<EventCallback>,
    ) {
        let mut reconnect_delay = Duration::from_secs(1);
        let max_reconnect_delay = Duration::from_secs(30);

        loop {
            tokio::select! {
                _ = shutdown_rx.recv() => {
                    info!("[OpenClaw] Connection loop: shutdown signal received");
                    break;
                }
                result = Self::connect_and_read(
                    port,
                    &token,
                    &agent_id,
                    &device_identity,
                    &connected,
                    &conn_notify,
                    &mut send_rx,
                    &on_event,
                ) => {
                    match result {
                        Ok(_) => {
                            reconnect_delay = Duration::from_secs(1);
                        }
                        Err(e) => {
                            error!("[OpenClaw] Connection error: {}", e);
                            if reconnect_delay < max_reconnect_delay {
                                reconnect_delay *= 2;
                            }
                        }
                    }
                }
            }

            // Wait before reconnecting
            tokio::select! {
                _ = shutdown_rx.recv() => {
                    break;
                }
                _ = sleep(reconnect_delay) => {
                    info!("[OpenClaw] Reconnecting...");
                }
            }
        }

        connected.store(false, Ordering::SeqCst);
    }

    /// Connect and read messages
    async fn connect_and_read(
        port: u16,
        token: &str,
        agent_id: &str,
        device_identity: &DeviceIdentity,
        connected: &Arc<AtomicBool>,
        conn_notify: &Arc<Notify>,
        send_rx: &mut mpsc::Receiver<Vec<u8>>,
        on_event: &Option<EventCallback>,
    ) -> Result<()> {
        let url = format!("ws://127.0.0.1:{}", port);

        info!("[OpenClaw] Connecting to {}", url);

        let (ws_stream, _) = connect_async(&url).await.context("Failed to connect")?;

        let (mut write, mut read) = ws_stream.split();

        // Wait for connect.challenge event to get the nonce
        let nonce = Self::wait_for_connect_challenge(&mut read).await?;

        // Send connect request with device identity and nonce
        Self::send_connect_request(&mut write, token, agent_id, device_identity, &nonce).await?;

        // Wait for connect response before marking as connected
        // The Gateway must acknowledge our connect request with ok:true
        // before we can send agent requests that require operator.write scope
        let connect_timeout = sleep(Duration::from_secs(10));
        tokio::pin!(connect_timeout);

        loop {
            tokio::select! {
                msg_result = read.next() => {
                    match msg_result {
                        Some(Ok(Message::Text(text))) => {
                            // Check if this is the connect response
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                                let msg_type = json.get("type").and_then(|v| v.as_str());
                                let msg_id = json.get("id").and_then(|v| v.as_str());

                                if msg_type == Some("res") && msg_id == Some("connect") {
                                    let ok = json.get("ok").and_then(|v| v.as_bool()).unwrap_or(false);
                                    if ok {
                                        info!("[OpenClaw] Connect handshake succeeded");
                                        break;
                                    } else {
                                        let error = json.get("error")
                                            .and_then(|e| e.get("message"))
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("unknown error");
                                        anyhow::bail!("Connect handshake failed: {}", error);
                                    }
                                }

                                // Forward non-connect events during handshake
                                if let Some(callback) = on_event {
                                    callback(text.into_bytes());
                                }
                            }
                        }
                        Some(Ok(Message::Binary(data))) => {
                            // Check binary connect response
                            if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&data) {
                                let msg_type = json.get("type").and_then(|v| v.as_str());
                                let msg_id = json.get("id").and_then(|v| v.as_str());

                                if msg_type == Some("res") && msg_id == Some("connect") {
                                    let ok = json.get("ok").and_then(|v| v.as_bool()).unwrap_or(false);
                                    if ok {
                                        info!("[OpenClaw] Connect handshake succeeded");
                                        break;
                                    } else {
                                        let error = json.get("error")
                                            .and_then(|e| e.get("message"))
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("unknown error");
                                        anyhow::bail!("Connect handshake failed: {}", error);
                                    }
                                }
                            }
                            if let Some(callback) = on_event {
                                callback(data);
                            }
                        }
                        Some(Ok(Message::Close(_))) => {
                            anyhow::bail!("Connection closed during handshake");
                        }
                        Some(Ok(Message::Ping(data))) => {
                            let _ = write.send(Message::Pong(data)).await;
                        }
                        Some(Ok(_)) => {}
                        Some(Err(e)) => {
                            anyhow::bail!("Read error during handshake: {}", e);
                        }
                        None => {
                            anyhow::bail!("Stream ended during handshake");
                        }
                    }
                }
                _ = &mut connect_timeout => {
                    anyhow::bail!("Timeout waiting for connect response from Gateway");
                }
            }
        }

        // Now mark as connected - Gateway has acknowledged our scopes
        connected.store(true, Ordering::SeqCst);
        conn_notify.notify_waiters();

        loop {
            tokio::select! {
                // Handle incoming messages
                msg_result = read.next() => {
                    match msg_result {
                        Some(Ok(Message::Text(text))) => {
                            let data = text.into_bytes();
                            if let Some(callback) = on_event {
                                callback(data);
                            }
                        }
                        Some(Ok(Message::Binary(data))) => {
                            if let Some(callback) = on_event {
                                callback(data);
                            }
                        }
                        Some(Ok(Message::Close(_))) => {
                            info!("[OpenClaw] Connection closed by server");
                            break;
                        }
                        Some(Ok(Message::Ping(data))) => {
                            if let Err(e) = write.send(Message::Pong(data)).await {
                                error!("[OpenClaw] Failed to send pong: {}", e);
                                break;
                            }
                        }
                        Some(Ok(_)) => {}
                        Some(Err(e)) => {
                            error!("[OpenClaw] Read error: {}", e);
                            break;
                        }
                        None => {
                            info!("[OpenClaw] Stream ended");
                            break;
                        }
                    }
                }
                // Handle outgoing messages
                Some(data) = send_rx.recv() => {
                    // Convert Vec<u8> to String for Text message (JSON should be valid UTF-8)
                    match String::from_utf8(data) {
                        Ok(text) => {
                            if let Err(e) = write.send(Message::Text(text)).await {
                                error!("[OpenClaw] Failed to send message: {}", e);
                                break;
                            }
                        }
                        Err(e) => {
                            error!("[OpenClaw] Failed to convert message to UTF-8: {}", e);
                            // Still send as binary fallback
                            if let Err(e) = write.send(Message::Binary(e.into_bytes())).await {
                                error!("[OpenClaw] Failed to send message: {}", e);
                                break;
                            }
                        }
                    }
                }
            }
        }

        connected.store(false, Ordering::SeqCst);
        conn_notify.notify_waiters();

        Ok(())
    }

    /// Wait for connect.challenge event and extract nonce
    async fn wait_for_connect_challenge(
        read: &mut futures_util::stream::SplitStream<
            tokio_tungstenite::WebSocketStream<
                tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
            >,
        >,
    ) -> Result<String> {
        let challenge_timeout = sleep(Duration::from_secs(10));
        tokio::pin!(challenge_timeout);

        loop {
            tokio::select! {
                msg_result = read.next() => {
                    match msg_result {
                        Some(Ok(Message::Text(text))) => {
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                                let msg_type = json.get("type").and_then(|v| v.as_str());
                                let event = json.get("event").and_then(|v| v.as_str());

                                if msg_type == Some("event") && event == Some("connect.challenge") {
                                    if let Some(payload) = json.get("payload") {
                                        if let Some(nonce) = payload.get("nonce").and_then(|v| v.as_str()) {
                                            info!("[OpenClaw] Received connect challenge with nonce");
                                            return Ok(nonce.to_string());
                                        }
                                    }
                                    anyhow::bail!("connect.challenge missing nonce payload");
                                }
                            }
                        }
                        Some(Ok(Message::Binary(data))) => {
                            if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&data) {
                                let msg_type = json.get("type").and_then(|v| v.as_str());
                                let event = json.get("event").and_then(|v| v.as_str());

                                if msg_type == Some("event") && event == Some("connect.challenge") {
                                    if let Some(payload) = json.get("payload") {
                                        if let Some(nonce) = payload.get("nonce").and_then(|v| v.as_str()) {
                                            info!("[OpenClaw] Received connect challenge with nonce");
                                            return Ok(nonce.to_string());
                                        }
                                    }
                                    anyhow::bail!("connect.challenge missing nonce payload");
                                }
                            }
                        }
                        Some(Ok(Message::Close(_))) => {
                            anyhow::bail!("Connection closed while waiting for challenge");
                        }
                        Some(Ok(Message::Ping(data))) => {
                            // Ignore pings during challenge wait
                            let _ = data;
                        }
                        Some(Ok(_)) => {}
                        Some(Err(e)) => {
                            anyhow::bail!("Error waiting for challenge: {}", e);
                        }
                        None => {
                            anyhow::bail!("Stream ended while waiting for challenge");
                        }
                    }
                }
                _ = &mut challenge_timeout => {
                    anyhow::bail!("Timeout waiting for connect.challenge");
                }
            }
        }
    }

    /// Send the initial connect handshake
    async fn send_connect_request(
        write: &mut futures_util::stream::SplitSink<
            tokio_tungstenite::WebSocketStream<
                tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
            >,
            Message,
        >,
        token: &str,
        _agent_id: &str,
        device_identity: &DeviceIdentity,
        nonce: &str,
    ) -> Result<()> {
        let signed_at = chrono::Utc::now().timestamp_millis();

        // Build device auth payload (v2 format with nonce):
        // v2|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce
        let scopes = "operator.read,operator.write,operator.admin";
        let payload = format!(
            "v2|{}|gateway-client|backend|operator|{}|{}|{}|{}",
            device_identity.device_id, scopes, signed_at, token, nonce
        );

        let signature = sign_device_payload(&device_identity.private_key, &payload);

        let connect_req = json!({
            "type": "req",
            "id": "connect",
            "method": "connect",
            "params": {
                "minProtocol": 3,
                "maxProtocol": 3,
                "client": {
                    "id": "gateway-client",
                    "version": "0.2.0",
                    "platform": "linux",
                    "mode": "backend",
                },
                "role": "operator",
                "scopes": ["operator.read", "operator.write", "operator.admin"],
                "auth": {
                    "token": token,
                },
                "locale": "zh-CN",
                "userAgent": "openclaw-bridge-rust",
                "device": {
                    "id": device_identity.device_id,
                    "publicKey": base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(device_identity.public_key),
                    "signature": signature,
                    "signedAt": signed_at,
                    "nonce": nonce,
                }
            }
        });

        info!(
            "[OpenClaw] Sending connect request with device identity: {}",
            device_identity.device_id
        );

        let data = serde_json::to_vec(&connect_req)?;
        write
            .send(Message::Binary(data))
            .await
            .context("Failed to send connect request")?;

        Ok(())
    }

    /// Send raw JSON data to OpenClaw Gateway
    pub async fn send_raw(&self, data: Vec<u8>) -> Result<()> {
        if !self.connected.load(Ordering::SeqCst) {
            // Wait for connection with timeout
            tokio::select! {
                _ = self.conn_notify.notified() => {
                    if !self.connected.load(Ordering::SeqCst) {
                        anyhow::bail!("Not connected to gateway");
                    }
                }
                _ = sleep(Duration::from_secs(5)) => {
                    anyhow::bail!("Timeout waiting for connection");
                }
            }
        }

        if let Some(tx) = &self.send_tx {
            tx.send(data).await.context("Failed to send message")?;
            Ok(())
        } else {
            anyhow::bail!("Send channel not initialized")
        }
    }

    /// Send an agent request to OpenClaw
    pub async fn send_agent_request(&self, message: &str, session_key: &str) -> Result<()> {
        let now = chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0);
        let request = AgentRequest {
            msg_type: "req".to_string(),
            id: format!("agent:{}", now),
            method: "agent".to_string(),
            params: AgentRequestParams {
                message: message.to_string(),
                agent_id: self.agent_id.clone(),
                session_key: session_key.to_string(),
                deliver: true,
                idempotency_key: format!("{}", now),
            },
        };

        let data = serde_json::to_vec(&request)?;
        self.send_raw(data).await
    }

    /// Close the connection
    pub async fn close(&mut self) -> Result<()> {
        info!("[OpenClaw] Closing connection...");

        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(()).await;
        }

        self.connected.store(false, Ordering::SeqCst);
        info!("[OpenClaw] Connection closed");
        Ok(())
    }
}
