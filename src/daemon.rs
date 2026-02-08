// Daemon process management for Unix-like systems
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::fs;
use std::process::{Command, Stdio};

use anyhow::{Context, Result};

use crate::config::config_dir;

/// Maximum log file size before rotation (10 MB)
const MAX_LOG_SIZE: u64 = 10 * 1024 * 1024;

/// Number of archived log files to keep
const MAX_ARCHIVED_LOGS: usize = 5;

/// Path to the PID file
pub fn pid_path() -> Result<std::path::PathBuf> {
    Ok(config_dir()?.join("bridge.pid"))
}

/// Path to the log file
pub fn log_path() -> Result<std::path::PathBuf> {
    Ok(config_dir()?.join("bridge.log"))
}

/// Rotate log files if they exceed the maximum size
pub fn rotate_logs_if_needed() -> Result<()> {
    let log_path = log_path()?;

    // Check if log file exists and its size
    if let Ok(metadata) = fs::metadata(&log_path) {
        if metadata.len() > MAX_LOG_SIZE {
            // Rotate existing logs
            rotate_archived_logs()?;
            // Archive current log
            let archive_path = log_path.with_extension("log.1");
            fs::rename(&log_path, &archive_path)
                .with_context(|| format!("Failed to rotate log file: {}", log_path.display()))?;
        }
    }

    Ok(())
}

/// Rotate archived log files (bridge.log.1 -> bridge.log.2, etc.)
fn rotate_archived_logs() -> Result<()> {
    let config_dir = config_dir()?;

    // Delete the oldest log if it exists
    let oldest_log = config_dir.join(format!("bridge.log.{}", MAX_ARCHIVED_LOGS));
    let _ = fs::remove_file(&oldest_log);

    // Rotate existing archived logs
    for i in (1..MAX_ARCHIVED_LOGS).rev() {
        let current = config_dir.join(format!("bridge.log.{}", i));
        let next = config_dir.join(format!("bridge.log.{}", i + 1));

        if current.exists() {
            fs::rename(&current, &next)
                .with_context(|| format!("Failed to rotate archived log: {}", current.display()))?;
        }
    }

    Ok(())
}

/// Clean up old archived logs (keep only MAX_ARCHIVED_LOGS)
pub fn cleanup_old_logs() -> Result<()> {
    let config_dir = config_dir()?;

    // Remove archived logs beyond the limit
    for i in (MAX_ARCHIVED_LOGS + 1)..100 {
        let log_file = config_dir.join(format!("bridge.log.{}", i));
        if log_file.exists() {
            fs::remove_file(&log_file)
                .with_context(|| format!("Failed to remove old log: {}", log_file.display()))?;
        } else {
            break;
        }
    }

    Ok(())
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

    // Rotate logs if needed before starting
    rotate_logs_if_needed()?;
    cleanup_old_logs()?;

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
