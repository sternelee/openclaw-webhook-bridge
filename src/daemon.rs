// Daemon process management for Unix-like systems
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::fs;
use std::process::{Command, Stdio};

use anyhow::{Context, Result};

use crate::config::config_dir;

/// Path to the PID file
pub fn pid_path() -> Result<std::path::PathBuf> {
    Ok(config_dir()?.join("bridge.pid"))
}

/// Path to the log file (optional, only created in run mode)
#[allow(dead_code)]
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

/// Get process start time (Unix)
#[cfg(unix)]
pub fn get_process_start_time(pid: u32) -> Option<String> {
    use std::process::Command;

    // Get process start time using ps
    let output = Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "lstart="])
        .output()
        .ok()?;

    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        None
    }
}

/// Get process start time (Windows stub)
#[cfg(windows)]
pub fn get_process_start_time(_pid: u32) -> Option<String> {
    None
}

/// Get last N lines from log file
#[allow(dead_code)]
pub fn get_last_log_lines(n: usize) -> Result<Vec<String>> {
    let log_path = log_path()?;
    if !log_path.exists() {
        return Ok(vec!["No log file".to_string()]);
    }

    let content = fs::read_to_string(&log_path)
        .with_context(|| format!("Failed to read log file: {}", log_path.display()))?;

    let lines: Vec<String> = content
        .lines()
        .rev()
        .take(n)
        .map(|s| s.to_string())
        .collect();

    Ok(lines.into_iter().rev().collect())
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

    // Get current executable
    let exe = std::env::current_exe()
        .context("Failed to get current executable path")?;

    // Spawn daemon process without log file (redirect to /dev/null)
    let child = Command::new(&exe)
        .arg("daemon-run")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .process_group(0)
        .spawn()
        .context("Failed to spawn daemon process")?;

    let pid = child.id();

    // Write PID file
    let pid_path = pid_path()?;
    fs::write(&pid_path, pid.to_string())
        .with_context(|| format!("Failed to write PID file: {}", pid_path.display()))?;

    println!("Started (PID {})", pid);

    Ok(())
}

/// Start the daemon process (Windows stub)
#[cfg(windows)]
pub fn start_daemon() -> Result<()> {
    anyhow::bail!("Daemon mode not yet implemented on Windows");
}

/// Get detailed daemon status
pub fn daemon_status_detailed() -> String {
    if let Ok(pid) = read_pid() {
        if is_process_running(pid) {
            let mut status = format!("Running (PID {})", pid);
            if let Some(start_time) = get_process_start_time(pid) {
                status.push_str(&format!("\nStarted: {}", start_time));
            }
            status
        } else {
            "Stopped (stale PID file)".to_string()
        }
    } else {
        "Not running".to_string()
    }
}
