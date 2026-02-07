use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

/// Main configuration for the bridge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub webhook_url: String,
    pub openclaw: OpenClawConfig,
    pub uid: String,
    pub session_store_path: String,
    pub session_scope: String,
}

/// OpenClaw Gateway configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenClawConfig {
    pub gateway_port: u16,
    pub gateway_token: String,
    pub agent_id: String,
}

/// Structure matching ~/.openclaw/openclaw.json
#[derive(Debug, Deserialize)]
struct OpenClawJSON {
    gateway: GatewayConfig,
}

#[derive(Debug, Deserialize)]
struct GatewayConfig {
    port: Option<u16>,
    auth: AuthConfig,
}

#[derive(Debug, Deserialize)]
struct AuthConfig {
    token: String,
}

/// Structure matching ~/.openclaw/bridge.json
#[derive(Debug, Serialize, Deserialize)]
pub struct BridgeJSON {
    pub webhook_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uid: Option<String>,
}

/// Get the config directory path
pub fn config_dir() -> Result<PathBuf> {
    let home = dirs::home_dir().context("Failed to get home directory")?;
    
    // Priority order: .openclaw
    let openclaw_dir = home.join(".openclaw");
    
    if openclaw_dir.exists() && openclaw_dir.is_dir() {
        Ok(openclaw_dir)
    } else {
        // Default to .openclaw even if it doesn't exist
        Ok(openclaw_dir)
    }
}

/// Find a config file from a list of candidates
fn find_config_file(dir: &PathBuf, candidates: &[&str]) -> Result<PathBuf> {
    for name in candidates {
        let path = dir.join(name);
        if path.exists() {
            return Ok(path);
        }
    }
    anyhow::bail!(
        "Config file not found, tried: {:?} in directory: {}",
        candidates,
        dir.display()
    );
}

/// Load configuration from config files
pub fn load() -> Result<Config> {
    let dir = config_dir()?;
    
    // Find and load gateway config
    let gw_path = find_config_file(&dir, &["openclaw.json", "openclaw.json"])?;
    let gw_data = fs::read_to_string(&gw_path)
        .with_context(|| format!("Failed to read {}", gw_path.display()))?;
    let gw_cfg: OpenClawJSON = serde_json::from_str(&gw_data)
        .with_context(|| format!("Failed to parse {}", gw_path.display()))?;
    
    // Find and load bridge config
    let br_path = find_config_file(&dir, &["bridge.json"])?;
    let br_data = fs::read_to_string(&br_path)
        .with_context(|| format!("Failed to read {}", br_path.display()))?;
    let br_cfg: BridgeJSON = serde_json::from_str(&br_data)
        .with_context(|| format!("Failed to parse {}", br_path.display()))?;
    
    // Validate required fields
    if br_cfg.webhook_url.is_empty() {
        anyhow::bail!("webhook_url is required in ~/.openclaw/bridge.json");
    }
    
    // Build config with defaults
    let agent_id = br_cfg.agent_id.unwrap_or_else(|| "main".to_string());
    let gateway_port = gw_cfg.gateway.port.unwrap_or(18789);
    let uid = br_cfg.uid.unwrap_or_else(|| generate_uid());
    let session_store_path = dir.join("sessions.json").to_string_lossy().to_string();
    
    Ok(Config {
        webhook_url: br_cfg.webhook_url,
        openclaw: OpenClawConfig {
            gateway_port,
            gateway_token: gw_cfg.gateway.auth.token,
            agent_id,
        },
        uid,
        session_store_path,
        session_scope: "per-sender".to_string(),
    })
}

/// Generate a unique ID using UUID v4
pub fn generate_uid() -> String {
    Uuid::new_v4().to_string()
}

/// Get a display string for the UID
pub fn get_display_uid(cfg: &Config) -> String {
    format!("Bridge UID: {}", cfg.uid)
}

/// Save bridge config to file
pub fn save_bridge_config(webhook_url: &str, uid: &str, agent_id: Option<&str>) -> Result<()> {
    let dir = config_dir()?;
    let path = dir.join("bridge.json");
    
    let cfg = BridgeJSON {
        webhook_url: webhook_url.to_string(),
        agent_id: agent_id.map(|s| s.to_string()),
        uid: Some(uid.to_string()),
    };
    
    let data = serde_json::to_string_pretty(&cfg)?;
    fs::write(&path, data)?;
    
    Ok(())
}
