use anyhow::{Context, Result};
use futures_util::{SinkExt, StreamExt};
use log::{error, info, warn};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Notify};
use tokio::time::sleep;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use url::Url;

type MessageHandler = Arc<dyn Fn(Vec<u8>) -> Result<()> + Send + Sync>;

/// WebSocket webhook client
pub struct Client {
    url: String,
    uid: String,
    handler: MessageHandler,
    connected: Arc<AtomicBool>,
    conn_notify: Arc<Notify>,
    shutdown_tx: Option<mpsc::Sender<()>>,
    send_tx: Option<mpsc::Sender<Vec<u8>>>,
}

impl Client {
    pub fn new<F>(url: String, uid: String, handler: F) -> Self
    where
        F: Fn(Vec<u8>) -> Result<()> + Send + Sync + 'static,
    {
        Self {
            url,
            uid,
            handler: Arc::new(handler),
            connected: Arc::new(AtomicBool::new(false)),
            conn_notify: Arc::new(Notify::new()),
            shutdown_tx: None,
            send_tx: None,
        }
    }

    /// Connect and start the connection loop
    pub async fn connect(&mut self) -> Result<()> {
        // Validate UID
        if self.uid.is_empty() {
            anyhow::bail!("UID is required for connection");
        }

        let (shutdown_tx, shutdown_rx) = mpsc::channel(1);
        let (send_tx, send_rx) = mpsc::channel(100);
        
        self.shutdown_tx = Some(shutdown_tx);
        self.send_tx = Some(send_tx);

        let url = self.url.clone();
        let uid = self.uid.clone();
        let handler = Arc::clone(&self.handler);
        let connected = Arc::clone(&self.connected);
        let conn_notify = Arc::clone(&self.conn_notify);

        // Spawn connection loop
        tokio::spawn(async move {
            Self::connection_loop(url, uid, handler, connected, conn_notify, shutdown_rx, send_rx).await;
        });

        // Wait for initial connection
        tokio::select! {
            _ = self.conn_notify.notified() => {
                if self.connected.load(Ordering::SeqCst) {
                    info!("[Webhook] Connected to {} (UID: {})", self.url, self.uid);
                    Ok(())
                } else {
                    anyhow::bail!("Failed to establish connection")
                }
            }
            _ = sleep(Duration::from_secs(5)) => {
                anyhow::bail!("Timeout connecting to webhook server")
            }
        }
    }

    /// Connection loop with auto-reconnect
    async fn connection_loop(
        url: String,
        uid: String,
        handler: MessageHandler,
        connected: Arc<AtomicBool>,
        conn_notify: Arc<Notify>,
        mut shutdown_rx: mpsc::Receiver<()>,
        mut send_rx: mpsc::Receiver<Vec<u8>>,
    ) {
        let mut reconnect_delay = Duration::from_secs(2);
        let max_reconnect_delay = Duration::from_secs(30);

        loop {
            tokio::select! {
                _ = shutdown_rx.recv() => {
                    info!("[Webhook] Connection loop: shutdown signal received");
                    break;
                }
                result = Self::connect_and_read(&url, &uid, &handler, &connected, &conn_notify, &mut send_rx) => {
                    match result {
                        Ok(_) => {
                            reconnect_delay = Duration::from_secs(2);
                        }
                        Err(e) => {
                            error!("[Webhook] Connection error: {}", e);
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
                    info!("[Webhook] Reconnecting...");
                }
            }
        }

        connected.store(false, Ordering::SeqCst);
    }

    /// Connect and read messages
    async fn connect_and_read(
        url: &str,
        uid: &str,
        handler: &MessageHandler,
        connected: &Arc<AtomicBool>,
        conn_notify: &Arc<Notify>,
        send_rx: &mut mpsc::Receiver<Vec<u8>>,
    ) -> Result<()> {
        // Append UID to URL
        let ws_url = Self::append_uid_to_url(url, uid)?;

        info!("[Webhook] Connecting to {} (UID: {})", ws_url, uid);

        let (ws_stream, _) = connect_async(&ws_url)
            .await
            .context("Failed to connect")?;

        let (mut write, mut read) = ws_stream.split();

        connected.store(true, Ordering::SeqCst);
        conn_notify.notify_waiters();

        loop {
            tokio::select! {
                // Handle incoming messages
                msg_result = read.next() => {
                    match msg_result {
                        Some(Ok(Message::Text(text))) => {
                            if let Err(e) = handler(text.into_bytes()) {
                                warn!("[Webhook] Handler error: {}", e);
                            }
                        }
                        Some(Ok(Message::Binary(data))) => {
                            if let Err(e) = handler(data) {
                                warn!("[Webhook] Handler error: {}", e);
                            }
                        }
                        Some(Ok(Message::Close(_))) => {
                            info!("[Webhook] Connection closed by server");
                            break;
                        }
                        Some(Ok(Message::Ping(data))) => {
                            if let Err(e) = write.send(Message::Pong(data)).await {
                                error!("[Webhook] Failed to send pong: {}", e);
                                break;
                            }
                        }
                        Some(Ok(_)) => {}
                        Some(Err(e)) => {
                            error!("[Webhook] Read error: {}", e);
                            break;
                        }
                        None => {
                            info!("[Webhook] Stream ended");
                            break;
                        }
                    }
                }
                // Handle outgoing messages
                Some(data) = send_rx.recv() => {
                    if let Err(e) = write.send(Message::Binary(data)).await {
                        error!("[Webhook] Failed to send message: {}", e);
                        break;
                    }
                }
            }
        }

        connected.store(false, Ordering::SeqCst);
        conn_notify.notify_waiters();

        Ok(())
    }

    /// Append UID to URL as query parameter
    fn append_uid_to_url(url: &str, uid: &str) -> Result<String> {
        let mut parsed = Url::parse(url).context("Invalid URL")?;
        parsed.query_pairs_mut().append_pair("uid", uid);
        Ok(parsed.to_string())
    }

    /// Send data to webhook
    pub async fn send(&self, data: Vec<u8>) -> Result<()> {
        if !self.connected.load(Ordering::SeqCst) {
            anyhow::bail!("Not connected");
        }

        if let Some(tx) = &self.send_tx {
            tx.send(data).await.context("Failed to send message")?;
            Ok(())
        } else {
            anyhow::bail!("Send channel not initialized")
        }
    }

    /// Close the connection
    pub async fn close(&mut self) -> Result<()> {
        info!("[Webhook] Closing connection...");
        
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(()).await;
        }
        
        self.connected.store(false, Ordering::SeqCst);
        info!("[Webhook] Connection closed");
        Ok(())
    }

    /// Check if connected
    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::SeqCst)
    }
}
