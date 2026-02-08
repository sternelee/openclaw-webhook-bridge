use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
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
fn find_config_file(dir: &Path, candidates: &[&str]) -> Result<PathBuf> {
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
    let uid = br_cfg.uid.unwrap_or_else(generate_uid);
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

/// Prompt user for input with optional default value
fn prompt_input(prompt: &str, default: &str) -> Result<String> {
    let mut input = String::new();

    // Prompt should already contain the default value formatting (e.g., "[default]: ")
    // so we just print it as-is
    print!("{}", prompt);
    if default.is_empty() {
        print!(" ");
    }
    io::stdout().flush()?;

    io::stdin().read_line(&mut input)?;
    let trimmed = input.trim();

    if trimmed.is_empty() {
        Ok(default.to_string())
    } else {
        Ok(trimmed.to_string())
    }
}

/// Load or prompt for webhook URL
pub fn load_or_prompt_webhook_url(webhook_url_arg: Option<String>) -> Result<String> {
    // Try to load from existing config first
    let dir = config_dir()?;
    let bridge_path = dir.join("bridge.json");

    let default_url = if bridge_path.exists() {
        let br_data = fs::read_to_string(&bridge_path)?;
        if let Ok(br_cfg) = serde_json::from_str::<BridgeJSON>(&br_data) {
            br_cfg.webhook_url
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    if let Some(url) = webhook_url_arg {
        // Command line arg provided, use it directly
        save_bridge_config_partially(Some(url.as_str()), None, None)?;
        Ok(url)
    } else {
        // Always prompt user (like Go version)
        let prompt = if !default_url.is_empty() {
            format!("Enter WebSocket URL [{}]:", default_url)
        } else {
            "Enter WebSocket URL (e.g., ws://localhost:8080/ws):".to_string()
        };

        let url = prompt_input(&prompt, &default_url)?;
        if url.is_empty() {
            anyhow::bail!("webhook_url is required");
        }

        // Save the provided URL
        save_bridge_config_partially(Some(url.as_str()), None, None)?;
        Ok(url)
    }
}

/// Load or prompt for UID
pub fn load_or_prompt_uid(uid_arg: Option<String>) -> Result<String> {
    // Try to load from existing config first
    let dir = config_dir()?;
    let bridge_path = dir.join("bridge.json");

    let default_uid = if bridge_path.exists() {
        let br_data = fs::read_to_string(&bridge_path)?;
        if let Ok(br_cfg) = serde_json::from_str::<BridgeJSON>(&br_data) {
            br_cfg.uid.unwrap_or_default()
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    if let Some(uid) = uid_arg {
        // Command line arg provided, use it directly
        save_bridge_config_partially(None, Some(uid.as_str()), None)?;
        Ok(uid)
    } else {
        // Always prompt user (like Go version)
        let prompt = if !default_uid.is_empty() {
            format!("Enter UID [{}]:", default_uid)
        } else {
            "Enter UID (optional, press Enter to auto-generate):".to_string()
        };

        let uid = prompt_input(&prompt, &default_uid)?;

        // Use provided input, default, or generate new UID
        let final_uid = if uid.is_empty() {
            if default_uid.is_empty() {
                generate_uid()
            } else {
                default_uid
            }
        } else {
            uid
        };

        // Save the UID
        save_bridge_config_partially(None, Some(final_uid.as_str()), None)?;
        Ok(final_uid)
    }
}

/// Save partial config without overwriting existing values
fn save_bridge_config_partially(
    webhook_url: Option<&str>,
    uid: Option<&str>,
    agent_id: Option<&str>,
) -> Result<()> {
    let dir = config_dir()?;
    let path = dir.join("bridge.json");

    // Read existing config if present
    let mut cfg = if path.exists() {
        let data = fs::read_to_string(&path)?;
        serde_json::from_str::<BridgeJSON>(&data).unwrap_or_else(|_| BridgeJSON {
            webhook_url: String::new(),
            agent_id: None,
            uid: None,
        })
    } else {
        BridgeJSON {
            webhook_url: String::new(),
            agent_id: None,
            uid: None,
        }
    };

    // Update provided fields
    if let Some(url) = webhook_url {
        cfg.webhook_url = url.to_string();
    }
    if let Some(new_uid) = uid {
        cfg.uid = Some(new_uid.to_string());
    }
    if let Some(id) = agent_id {
        cfg.agent_id = Some(id.to_string());
    }

    let data = serde_json::to_string_pretty(&cfg)?;
    fs::write(&path, data)?;

    Ok(())
}

/// Print connection QR code to terminal
pub fn print_connection_qrcode(webhook_url: &str, uid: &str) {
    use qrcode::{Color, QrCode};

    if webhook_url.is_empty() || uid.is_empty() {
        return;
    }

    let payload = match serde_json::to_string(&serde_json::json!({
        "wsUrl": webhook_url,
        "uid": uid
    })) {
        Ok(p) => p,
        Err(e) => {
            log::warn!("[Config] Failed to build QR payload: {}", e);
            return;
        }
    };

    let qr = match QrCode::new(&payload) {
        Ok(q) => q,
        Err(e) => {
            log::warn!("[Config] Failed to generate QR: {}", e);
            return;
        }
    };

    println!("Scan this QR with openclaw-mapp to connect:");

    // Render QR code using Unicode block elements
    let size = qr.width();
    const BORDER: usize = 1;

    // Unicode block elements for 2x1 pixel rendering
    const UPPER: char = '\u{2580}'; // ▀
    const LOWER: char = '\u{2584}'; // ▄
    const FULL: char = '\u{2588}'; // █
    const EMPTY: char = ' ';

    for y in (0..size + 2 * BORDER).step_by(2) {
        let mut line = String::new();
        for x in 0..size + 2 * BORDER {
            let top = if y >= BORDER && y < size + BORDER && x >= BORDER && x < size + BORDER {
                matches!(qr[(x - BORDER, y - BORDER)], Color::Dark)
            } else {
                false
            };
            let bottom =
                if y + 1 >= BORDER && y + 1 < size + BORDER && x >= BORDER && x < size + BORDER {
                    matches!(qr[(x - BORDER, y + 1 - BORDER)], Color::Dark)
                } else {
                    false
                };

            let ch = match (top, bottom) {
                (true, true) => FULL,
                (true, false) => UPPER,
                (false, true) => LOWER,
                (false, false) => EMPTY,
            };
            line.push(ch);
        }
        println!("{}", line);
    }

    println!("QR payload: {}\n", payload);
}
