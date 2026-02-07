use anyhow::{Context, Result};
use futures_util::{SinkExt, StreamExt};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Notify};
use tokio::time::sleep;
use tokio_tungstenite::{connect_async, tungstenite::Message};

type EventCallback = Arc<dyn Fn(Vec<u8>) + Send + Sync>;

/// OpenClaw Gateway WebSocket client
pub struct Client {
    port: u16,
    token: String,
    agent_id: String,
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
    pub fn new(port: u16, token: String, agent_id: String) -> Self {
        Self {
            port,
            token,
            agent_id,
            connected: Arc::new(AtomicBool::new(false)),
            conn_notify: Arc::new(Notify::new()),
            shutdown_tx: None,
            send_tx: None,
            on_event: None,
        }
    }

    pub fn set_event_callback<F>(&mut self, callback: F)
    where
        F: Fn(Vec<u8>) + Send + Sync + 'static,
    {
        self.on_event = Some(Arc::new(callback));
    }

    pub fn agent_id(&self) -> &str {
        &self.agent_id
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
        let connected = Arc::clone(&self.connected);
        let conn_notify = Arc::clone(&self.conn_notify);
        let on_event = self.on_event.clone();

        // Spawn connection loop
        tokio::spawn(async move {
            Self::connection_loop(
                port,
                token,
                agent_id,
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
    async fn connection_loop(
        port: u16,
        token: String,
        agent_id: String,
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
        connected: &Arc<AtomicBool>,
        conn_notify: &Arc<Notify>,
        send_rx: &mut mpsc::Receiver<Vec<u8>>,
        on_event: &Option<EventCallback>,
    ) -> Result<()> {
        let url = format!("ws://127.0.0.1:{}", port);

        info!("[OpenClaw] Connecting to {}", url);

        let (ws_stream, _) = connect_async(&url).await.context("Failed to connect")?;

        let (mut write, mut read) = ws_stream.split();

        // Send connect request immediately
        Self::send_connect_request(&mut write, token, agent_id).await?;

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
                    if let Err(e) = write.send(Message::Binary(data)).await {
                        error!("[OpenClaw] Failed to send message: {}", e);
                        break;
                    }
                }
            }
        }

        connected.store(false, Ordering::SeqCst);
        conn_notify.notify_waiters();

        Ok(())
    }

    /// Send the initial connect handshake
    async fn send_connect_request(
        write: &mut futures_util::stream::SplitSink<
            tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
            Message,
        >,
        token: &str,
        agent_id: &str,
    ) -> Result<()> {
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
            }
        });

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

    /// Check if connected
    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::SeqCst)
    }
}
