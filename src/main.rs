mod bridge;
mod commands;
mod config;
mod daemon;
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
    /// Internal command: run as daemon process
    DaemonRun,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Parse command line args first
    let args: Vec<String> = std::env::args().collect();

    // Check for daemon-run command directly (for re-exec)
    if args.len() > 1 && args[1] == "daemon-run" {
        return run_daemon().await;
    }

    // For other commands, use clap
    let cli = Cli::parse();

    let command = cli.command.unwrap_or(Commands::Run {
        webhook_url: None,
        uid: None,
    });

    match command {
        Commands::Start { webhook_url, uid } => {
            cmd_start(webhook_url, uid)
        }
        Commands::Stop => {
            cmd_stop()
        }
        Commands::Status => {
            cmd_status()
        }
        Commands::Restart { webhook_url, uid } => {
            cmd_restart(webhook_url, uid)
        }
        Commands::Run { webhook_url, uid } => {
            cmd_run(webhook_url, uid).await
        }
        Commands::DaemonRun => {
            run_daemon().await
        }
    }
}

fn cmd_start(webhook_url: Option<String>, uid: Option<String>) -> Result<()> {
    // Check if already running
    if daemon::is_running() {
        eprintln!("Already running");
        std::process::exit(1);
    }

    // Handle interactive input for webhook_url and uid if not provided
    let webhook_url = load_or_prompt_webhook_url(webhook_url)?;
    let uid = load_or_prompt_uid(uid)?;

    // Save config if prompted
    config::save_webhook_url(&webhook_url)?;
    config::save_uid(&uid)?;

    // Show UID and QR code
    display_uid_and_qrcode(&uid, &webhook_url);

    // Start daemon
    daemon::start_daemon()?;

    Ok(())
}

fn cmd_stop() -> Result<()> {
    match daemon::stop_daemon() {
        Ok(()) => {
            println!("Stopped");
            Ok(())
        }
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(1);
        }
    }
}

fn cmd_status() -> Result<()> {
    let status = daemon::daemon_status_detailed();
    println!("{}", status);
    Ok(())
}

fn cmd_restart(webhook_url: Option<String>, uid: Option<String>) -> Result<()> {
    // Stop if running
    if daemon::is_running() {
        println!("Stopping running daemon...");
        let _ = daemon::stop_daemon();

        // Wait for process to stop
        if let Ok(pid) = daemon::read_pid() {
            for _ in 0..10 {
                std::thread::sleep(std::time::Duration::from_millis(200));
                if !daemon::is_process_running(pid) {
                    break;
                }
            }
        }
    }

    // Clean up stale PID file
    let _ = std::fs::remove_file(daemon::pid_path()?);

    // Start new daemon
    cmd_start(webhook_url, uid)
}

async fn cmd_run(webhook_url: Option<String>, uid: Option<String>) -> Result<()> {
    // Handle interactive input if not provided
    let webhook_url = load_or_prompt_webhook_url(webhook_url)?;
    let uid = load_or_prompt_uid(uid)?;

    // Save config if prompted
    config::save_webhook_url(&webhook_url)?;
    config::save_uid(&uid)?;

    // Show UID and QR code
    display_uid_and_qrcode(&uid, &webhook_url);

    // Run bridge in foreground
    run_bridge().await
}

/// Run bridge as daemon process (after re-exec)
async fn run_daemon() -> Result<()> {
    // Initialize logger (stdout/stderr are already redirected to log file by daemon.rs)
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_millis()
        .init();

    run_bridge().await
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

    // Clean up PID file if we're the daemon
    if let Ok(pid_path) = daemon::pid_path() {
        let _ = std::fs::remove_file(pid_path);
    }

    Ok(())
}
