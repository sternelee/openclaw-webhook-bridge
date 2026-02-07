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
    Run,
}

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let cli = Cli::parse();

    match cli.command.unwrap_or(Commands::Run) {
        Commands::Start {
            webhook_url,
            uid: _uid,
        } => {
            println!("Starting bridge...");
            if webhook_url.is_some() {
                println!("Note: Command-line config override not yet implemented");
            }
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
        Commands::Restart {
            webhook_url,
            uid: _uid,
        } => {
            println!("Restarting bridge...");
            if webhook_url.is_some() {
                println!("Note: Command-line config override not yet implemented");
            }
            println!("Note: Daemon mode not yet implemented in Rust version");
            Ok(())
        }
        Commands::Run => run_bridge().await,
    }
}

async fn run_bridge() -> Result<()> {
    info!("[Main] Starting OpenClaw Bridge (Rust)...");

    // Load configuration
    let cfg = config::load()?;

    // Display UID
    println!();
    println!("╔══════════════════════════════════════════════════════════╗");
    println!("║  {}                                         ║", config::get_display_uid(&cfg));
    println!("╚══════════════════════════════════════════════════════════╝");
    println!();
    
    info!(
        "[Main] Loaded config: WebhookURL={}, Gateway=127.0.0.1:{}, AgentID={}",
        cfg.webhook_url, cfg.openclaw.gateway_port, cfg.openclaw.agent_id
    );

    // Create session store
    let session_store = Arc::new(sessions::Store::new(sessions::StoreConfig::new(
        std::path::PathBuf::from(&cfg.session_store_path),
    )));
    info!("[Main] Session store configured: {}", cfg.session_store_path);

    // Create bridge
    let bridge = Arc::new(bridge::Bridge::new(cfg.openclaw.agent_id.clone()));
    {
        let mut bridge_mut = Arc::as_ref(&bridge);
        // Note: This is a simplified approach. In a production system,
        // you'd use interior mutability patterns like RwLock for configuration
    }

    // Create OpenClaw client
    let mut openclaw_client =
        openclaw::Client::new(cfg.openclaw.gateway_port, cfg.openclaw.gateway_token.clone(), cfg.openclaw.agent_id.clone());

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

    let mut webhook_client = webhook::Client::new(cfg.webhook_url.clone(), cfg.uid.clone(), webhook_handler);

    // Store clients in bridge (requires interior mutability in real impl)
    bridge.set_openclaw_client(openclaw_client).await;
    bridge.set_webhook_client(webhook_client).await;

    // Note: The above code is simplified. A real implementation would properly 
    // manage the client lifecycle and use the stored references.
    
    // For now, create new clients for actual connection
    let mut openclaw_client =
        openclaw::Client::new(cfg.openclaw.gateway_port, cfg.openclaw.gateway_token, cfg.openclaw.agent_id);

    let bridge_clone = Arc::clone(&bridge);
    openclaw_client.set_event_callback(move |data| {
        let bridge = Arc::clone(&bridge_clone);
        tokio::spawn(async move {
            bridge.handle_openclaw_event(data).await;
        });
    });

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

    let mut webhook_client = webhook::Client::new(cfg.webhook_url, cfg.uid, webhook_handler);

    // Connect to OpenClaw Gateway
    info!("[Main] Connecting to OpenClaw Gateway...");
    openclaw_client.connect().await?;
    info!("[Main] Connected to OpenClaw Gateway");

    // Connect to Webhook server
    info!("[Main] Connecting to Webhook server...");
    webhook_client.connect().await?;
    info!("[Main] Connected to Webhook server");

    info!("[Main] OpenClaw Bridge started successfully");
    info!("[Main] Press Ctrl+C to stop");

    // Wait for shutdown signal
    signal::ctrl_c().await?;
    info!("[Main] Received shutdown signal, stopping...");

    // Cleanup
    webhook_client.close().await?;
    openclaw_client.close().await?;

    info!("[Main] OpenClaw Bridge stopped");
    Ok(())
}
