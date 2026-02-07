mod config;
mod sessions;
mod webhook;
// mod openclaw;
// mod bridge;
// mod commands;

use anyhow::Result;
use clap::{Parser, Subcommand};

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
    env_logger::init();
    
    let cli = Cli::parse();
    
    match cli.command.unwrap_or(Commands::Run) {
        Commands::Start { webhook_url, uid } => {
            println!("Starting bridge...");
            println!("Note: Daemon mode not yet implemented in Rust version");
            Ok(())
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
            println!("Note: Daemon mode not yet implemented in Rust version");
            Ok(())
        }
        Commands::Run => {
            println!("Running bridge in foreground...");
            println!("Note: Full implementation in progress");
            
            // Test config loading
            match config::load() {
                Ok(cfg) => {
                    println!("Config loaded successfully!");
                    println!("  Webhook URL: {}", cfg.webhook_url);
                    println!("  Gateway Port: {}", cfg.openclaw.gateway_port);
                    println!("  Agent ID: {}", cfg.openclaw.agent_id);
                    println!("  UID: {}", cfg.uid);
                }
                Err(e) => {
                    eprintln!("Failed to load config: {}", e);
                }
            }
            
            Ok(())
        }
    }
}
