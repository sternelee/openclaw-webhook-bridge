// Daemon process management for Unix-like systems
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::process::{Command, Stdio};
use std::fs;

use anyhow::{Context, Result};

use crate::config::config_dir;

/// Path to the PID file
pub fn pid_path() -> Result<std::path::PathBuf> {
    Ok(config_dir()?.join("bridge.pid"))
}

/// Path to the log file
pub fn log_path() -> Result<std::path::PathBuf> {
    Ok(config_dir()?.join("bridge.log"))
}

/// Read PID from file
pub fn read_pid() -> Result<u32> {
    let path = pid_path()?;
    let content = fs::read_to_string(&path)
        .with_context(|| format!("Failed to read PID file: {}", path.display()))?;
    let pid: u32 = content
        .trim()
        .parse()
        .with_context(|| format!("Invalid PID in file: {}", content))?;
    Ok(pid)
}

/// Check if process is running (Unix)
#[cfg(unix)]
pub fn is_process_running(pid: u32) -> bool {
    use std::process;

    // Check if it's the current process
    if process::id() == pid {
        return true;
    }

    // Use kill -0 to check if process exists (harmless signal)
    Command::new("kill")
        .arg("-0")
        .arg(pid.to_string())
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

/// Check if process is running (Windows stub)
#[cfg(windows)]
pub fn is_process_running(_pid: u32) -> bool {
    // TODO: Implement Windows version
    false
}

/// Check if daemon is already running
pub fn is_running() -> bool {
    if let Ok(pid) = read_pid() {
        is_process_running(pid)
    } else {
        false
    }
}

/// Stop the daemon process (Unix)
#[cfg(unix)]
pub fn stop_daemon() -> Result<()> {
    let pid = read_pid()?;
    if !is_process_running(pid) {
        anyhow::bail!("Daemon is not running");
    }

    Command::new("kill")
        .arg("-TERM")
        .arg(pid.to_string())
        .output()
        .context("Failed to send SIGTERM to daemon")?;

    // Remove PID file
    let pid_path = pid_path()?;
    fs::remove_file(&pid_path)
        .with_context(|| format!("Failed to remove PID file: {}", pid_path.display()))?;

    Ok(())
}

/// Stop the daemon process (Windows stub)
#[cfg(windows)]
pub fn stop_daemon() -> Result<()> {
    // TODO: Implement Windows version
    anyhow::bail!("Daemon mode not yet implemented on Windows");
}

/// Start the daemon process (Unix)
#[cfg(unix)]
pub fn start_daemon() -> Result<()> {
    if is_running() {
        anyhow::bail!("Daemon is already running");
    }

    // Open log file
    let log_path = log_path()?;
    let log_file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .with_context(|| format!("Failed to open log file: {}", log_path.display()))?;

    // Get current executable
    let exe = std::env::current_exe()
        .context("Failed to get current executable path")?;

    // Spawn daemon process
    let child = Command::new(&exe)
        .arg("daemon-run")
        .stdin(Stdio::null())
        .stdout(log_file.try_clone()?)
        .stderr(log_file)
        .process_group(0)
        .spawn()
        .context("Failed to spawn daemon process")?;

    let pid = child.id();

    // Write PID file
    let pid_path = pid_path()?;
    fs::write(&pid_path, pid.to_string())
        .with_context(|| format!("Failed to write PID file: {}", pid_path.display()))?;

    println!("Started (PID {}), log: {}", pid, log_path.display());

    Ok(())
}

/// Start the daemon process (Windows stub)
#[cfg(windows)]
pub fn start_daemon() -> Result<()> {
    anyhow::bail!("Daemon mode not yet implemented on Windows");
}

/// Get daemon status
pub fn daemon_status() -> String {
    if let Ok(pid) = read_pid() {
        if is_process_running(pid) {
            format!("Running (PID {})", pid)
        } else {
            "Stopped (stale PID file)".to_string()
        }
    } else {
        "Not running".to_string()
    }
}
