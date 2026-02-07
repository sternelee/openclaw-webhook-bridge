# OpenClaw Bridge - Rust Implementation

This is a Rust implementation of the OpenClaw Webhook Bridge, providing the same functionality as the Go version with improved performance and memory safety.

## Features

- ✅ WebSocket client for webhook server with UID-based routing
- ✅ OpenClaw Gateway WebSocket client with protocol v3 support
- ✅ Session management with file-based persistence
- ✅ Automatic reconnection with exponential backoff
- ✅ Message routing between webhook and OpenClaw
- ✅ Command handling
- ✅ Session reset triggers
- ⏳ Daemon mode (in progress)
- ⏳ QR code display (in progress)

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
# - target/debug/openclaw-bridge-rust (debug)
# - target/release/openclaw-bridge-rust (release)
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

The Rust implementation follows the same command structure as the Go version:

```bash
# Run in foreground (recommended for now)
./target/release/openclaw-bridge-rust run

# Start as daemon (not yet fully implemented)
./target/release/openclaw-bridge-rust start

# Check status
./target/release/openclaw-bridge-rust status

# Stop daemon
./target/release/openclaw-bridge-rust stop
```

## Configuration

The Rust implementation uses the same configuration files as the Go version:

- `~/.openclaw/openclaw.json` - OpenClaw Gateway configuration
- `~/.openclaw/bridge.json` - Bridge configuration
- `~/.openclaw/sessions.json` - Session store (auto-created)

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
RUST_LOG=info ./openclaw-bridge-rust run

# Debug level (verbose)
RUST_LOG=debug ./openclaw-bridge-rust run

# Warn level (quiet)
RUST_LOG=warn ./openclaw-bridge-rust run
```

## Differences from Go Version

### Implemented

1. **Async/await**: Uses Tokio for efficient async I/O
2. **Type safety**: Strong type system prevents many runtime errors
3. **Memory safety**: No data races or null pointer dereferences
4. **Performance**: Lower memory footprint and better resource utilization

### In Progress

1. **Daemon mode**: Unix daemon and Windows service support
2. **QR code display**: Terminal QR code rendering
3. **PID file management**: Process management utilities
4. **Full session control**: Complete session control message handling

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
```

## License

MIT License - Same as the Go version

## Contributing

This implementation aims to maintain feature parity with the Go version while leveraging Rust's unique advantages. Contributions are welcome!
