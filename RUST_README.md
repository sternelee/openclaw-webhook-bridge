# OpenClaw Bridge - Rust Implementation

This is the Rust implementation of the OpenClaw Webhook Bridge, providing a production-ready bridge between WebSocket webhook services and the OpenClaw AI Gateway.

## Features

- ✅ WebSocket client for webhook server with UID-based routing
- ✅ OpenClaw Gateway WebSocket client with protocol v3 support
- ✅ Session management with file-based persistence
- ✅ Automatic reconnection with exponential backoff
- ✅ Message routing between webhook and OpenClaw
- ✅ Command handling (`/help`, `/commands`, `/skill`, `/approve`)
- ✅ Session reset triggers (`/new`, `/reset`)
- ✅ Daemon mode (Unix and Windows)
- ✅ QR code display for easy UID sharing

## Building

### Prerequisites

- Rust 1.70 or later
- Cargo (comes with Rust)

### Build from source

```bash
# Debug build
cargo build

# Release build (optimized)
cargo build --release

# The binary will be at:
# - target/debug/openclaw-bridge (debug)
# - target/release/openclaw-bridge (release)
```

### Cross-compilation

```bash
# Install cross-compilation tool
cargo install cross

# Build for Linux x86_64
cross build --release --target x86_64-unknown-linux-gnu

# Build for Linux ARM64
cross build --release --target aarch64-unknown-linux-gnu

# Build for macOS x86_64
cross build --release --target x86_64-apple-darwin

# Build for macOS ARM64 (Apple Silicon)
cross build --release --target aarch64-apple-darwin

# Build for Windows
cross build --release --target x86_64-pc-windows-gnu
```

## Usage

```bash
# Run in foreground (useful for debugging)
./openclaw-bridge run

# Start as daemon (background)
./openclaw-bridge start

# Check status
./openclaw-bridge status

# Stop daemon
./openclaw-bridge stop

# Restart daemon
./openclaw-bridge restart
```

### Command-line Arguments

```bash
# Start with explicit webhook URL
./openclaw-bridge start webhook_url=ws://localhost:8080/ws

# Start with custom agent ID
./openclaw-bridge start agent_id=custom-agent
```

## Configuration

The bridge uses the following configuration files in `~/.openclaw/`:

- `openclaw.json` - OpenClaw Gateway configuration
- `bridge.json` - Bridge configuration
- `sessions.json` - Session store (auto-created)

Example `~/.openclaw/bridge.json`:

```json
{
  "webhook_url": "ws://localhost:8080/ws",
  "agent_id": "main",
  "uid": "your-unique-id"
}
```

## Logging

Set the log level using the `RUST_LOG` environment variable:

```bash
# Info level (default)
RUST_LOG=info ./openclaw-bridge run

# Debug level (verbose)
RUST_LOG=debug ./openclaw-bridge run

# Warn level (quiet)
RUST_LOG=warn ./openclaw-bridge run
```

## Architecture

The Rust implementation provides several advantages:

1. **Async/await**: Uses Tokio for efficient async I/O
2. **Type safety**: Strong type system prevents many runtime errors
3. **Memory safety**: No data races or null pointer dereferences
4. **Performance**: Lower memory footprint (~2-3MB) and better resource utilization
5. **Small binary**: ~2.7MB when stripped (vs ~10MB for Go)

### Module Structure

- `src/main.rs` - CLI entry point and command handling
- `src/bridge/` - Core routing logic
- `src/commands/` - Slash command parsing and handling
- `src/config/` - Configuration file loading
- `src/openclaw/` - OpenClaw Gateway WebSocket client
- `src/sessions/` - Session persistence and management
- `src/webhook/` - Webhook server WebSocket client

## Dependencies

Key dependencies:

- `tokio` - Async runtime
- `tokio-tungstenite` - WebSocket client
- `serde` / `serde_json` - JSON serialization
- `anyhow` / `thiserror` - Error handling
- `clap` - CLI parsing
- `log` / `env_logger` - Logging
- `fs2` - File locking
- `uuid` - UID generation
- `chrono` - Time handling

## Development

```bash
# Run with cargo (auto-rebuild)
cargo run -- run

# Run tests
cargo test

# Format code
cargo fmt

# Check code (no build)
cargo check

# Lint code
cargo clippy

# Make commands
make build         # Build current platform
make build-release # Build release version
make fmt           # Format code
make clippy        # Run linter
make lint          # Format + lint
make test          # Run tests
```

## License

MIT License

## Contributing

Contributions are welcome! The project is actively maintained and aims to provide a robust, efficient bridge between WebSocket webhook services and the OpenClaw AI Gateway.
