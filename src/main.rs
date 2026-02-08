mod bridge;
mod commands;
mod config;
mod openclaw;
mod sessions;
mod webhook;

use anyhow::Result;
use clap::{Parser, Subcommand};
use log::info;
use std::sync::Arc;
use tokio::signal;

use config::{load_or_prompt_uid, load_or_prompt_webhook_url};

#[derive(Parser)]
#[command(name = "openclaw-bridge-rust")]
#[command(about = "Bridge between WebSocket webhooks and OpenClaw AI Gateway", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the bridge as a daemon
    Start {
        #[arg(long)]
        webhook_url: Option<String>,
        #[arg(long)]
        uid: Option<String>,
    },
    /// Stop the bridge daemon
    Stop,
    /// Check bridge status
    Status,
    /// Restart the bridge daemon
    Restart {
        #[arg(long)]
        webhook_url: Option<String>,
        #[arg(long)]
        uid: Option<String>,
    },
    /// Run the bridge in foreground (for debugging)
    Run {
        #[arg(long)]
        webhook_url: Option<String>,
        #[arg(long)]
        uid: Option<String>,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let cli = Cli::parse();

    let command = cli.command.unwrap_or(Commands::Run {
        webhook_url: None,
        uid: None,
    });

    match command {
        Commands::Start { webhook_url, uid } => {
            println!("Starting bridge...");

            // Handle interactive input for webhook_url and uid if not provided
            let webhook_url = load_or_prompt_webhook_url(webhook_url)?;
            let uid = load_or_prompt_uid(uid)?;

            // Show UID and QR code
            display_uid_and_qrcode(&uid, &webhook_url);

            println!("Note: Daemon mode not yet fully implemented in Rust version");
            println!("Running in foreground instead...");
            run_bridge().await
        }
        Commands::Stop => {
            println!("Stopping bridge...");
            println!("Note: Daemon mode not yet implemented in Rust version");
            Ok(())
        }
        Commands::Status => {
            println!("Checking bridge status...");
            println!("Note: Daemon mode not yet implemented in Rust version");
            Ok(())
        }
        Commands::Restart { webhook_url, uid } => {
            println!("Restarting bridge...");

            // Handle interactive input if not provided
            let webhook_url = load_or_prompt_webhook_url(webhook_url)?;
            let uid = load_or_prompt_uid(uid)?;

            // Show UID and QR code
            display_uid_and_qrcode(&uid, &webhook_url);

            println!("Note: Daemon mode not yet implemented in Rust version");
            Ok(())
        }
        Commands::Run { webhook_url, uid } => {
            // Handle interactive input if not provided
            let webhook_url = load_or_prompt_webhook_url(webhook_url)?;
            let uid = load_or_prompt_uid(uid)?;

            // Show UID and QR code
            display_uid_and_qrcode(&uid, &webhook_url);

            run_bridge().await
        }
    }
}

fn display_uid_and_qrcode(uid: &str, webhook_url: &str) {
    println!();
    println!("╔══════════════════════════════════════════════════════════╗");
    println!("║  Bridge UID: {:36} ║", uid);
    println!("╚══════════════════════════════════════════════════════════╝");
    println!();

    // Display QR code
    config::print_connection_qrcode(webhook_url, uid);
}

async fn run_bridge() -> Result<()> {
    info!("[Main] Starting OpenClaw Bridge (Rust)...");

    // Load configuration
    let cfg = config::load()?;

    info!(
        "[Main] Loaded config: WebhookURL={}, Gateway=127.0.0.1:{}, AgentID={}, UID={}",
        cfg.webhook_url, cfg.openclaw.gateway_port, cfg.openclaw.agent_id, cfg.uid
    );

    // Create session store
    let session_store = Arc::new(sessions::Store::new(sessions::StoreConfig::new(
        std::path::PathBuf::from(&cfg.session_store_path),
    )));
    info!(
        "[Main] Session store configured: {}",
        cfg.session_store_path
    );

    // Parse session scope from config
    let session_scope = match cfg.session_scope.as_str() {
        "global" => sessions::SessionScope::Global,
        _ => sessions::SessionScope::PerSender,
    };

    // Create bridge with agent_id
    let bridge = Arc::new(bridge::Bridge::new(cfg.openclaw.agent_id.clone()));

    // Configure bridge
    bridge.set_uid(cfg.uid.clone()).await;
    bridge.set_session_store(Arc::clone(&session_store)).await;
    bridge.set_session_scope(session_scope).await;

    // Create OpenClaw client
    let mut openclaw_client = openclaw::Client::new(
        cfg.openclaw.gateway_port,
        cfg.openclaw.gateway_token.clone(),
        cfg.openclaw.agent_id.clone(),
    );

    // Set event callback
    let bridge_clone = Arc::clone(&bridge);
    openclaw_client.set_event_callback(move |data| {
        let bridge = Arc::clone(&bridge_clone);
        tokio::spawn(async move {
            bridge.handle_openclaw_event(data).await;
        });
    });

    // Create webhook client
    let bridge_clone = Arc::clone(&bridge);
    let webhook_handler = move |data: Vec<u8>| {
        let bridge = Arc::clone(&bridge_clone);
        tokio::spawn(async move {
            if let Err(e) = bridge.handle_webhook_message(data).await {
                log::warn!("[Main] Error handling webhook message: {}", e);
            }
        });
        Ok(())
    };

    let mut webhook_client =
        webhook::Client::new(cfg.webhook_url.clone(), cfg.uid.clone(), webhook_handler);

    // Connect to OpenClaw Gateway
    info!("[Main] Connecting to OpenClaw Gateway...");
    openclaw_client.connect().await?;
    info!("[Main] Connected to OpenClaw Gateway");

    // Connect to Webhook server
    info!("[Main] Connecting to Webhook server...");
    webhook_client.connect().await?;
    info!("[Main] Connected to Webhook server");

    // Store clients in bridge after connection
    bridge.set_openclaw_client(openclaw_client).await;
    bridge.set_webhook_client(webhook_client).await;

    info!("[Main] OpenClaw Bridge started successfully");
    info!("[Main] Press Ctrl+C to stop");

    // Wait for shutdown signal
    signal::ctrl_c().await?;
    info!("[Main] Received shutdown signal, stopping...");

    // Get clients from bridge for cleanup
    let openclaw_opt = bridge.take_openclaw_client().await;
    let webhook_opt = bridge.take_webhook_client().await;

    // Cleanup
    if let Some(mut client) = webhook_opt {
        let _ = client.close().await;
    }
    if let Some(mut client) = openclaw_opt {
        let _ = client.close().await;
    }

    info!("[Main] OpenClaw Bridge stopped");
    Ok(())
}
