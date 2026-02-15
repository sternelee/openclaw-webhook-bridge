# OpenClaw Bridge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Rust Version](https://img.shields.io/badge/Rust-1.70+-orange?flat&logo=rust)](https://www.rust-lang.org)

> **[English](README.md) | [简体中文](README_ZH.md)**

OpenClaw is an AI Agent Gateway system. openclaw-run is the official bridge implementation containing a Rust bridge service, Cloudflare Workers webhook, and web frontend applications.

## System Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│ WeChat Mini-    │◄──────────────────►│ Cloudflare       │
│ Program (Taro)  │    (ws://...?uid)  │ Workers Webhook  │
└─────────────────┘                     └────────┬─────────┘
                                                │
┌─────────────────┐                           │
│ Next.js Web App │◄──────────────────────────┘
│ (OpenNext/CF)   │
└─────────────────┘
                                                │
                                                ▼
                                       ┌──────────────────┐
                                       │ OpenClaw Bridge  │
                                       │ (connects to     │
                                       │  OpenClaw)       │
                                       └────────┬─────────┘
                                                │
                                                ▼
                                       ┌──────────────────┐
                                       │ OpenClaw         │
                                       │ AI Gateway       │
                                       │ (localhost:18789)│
                                       └──────────────────┘
```

## Components

| Component | Directory | Tech Stack | Description |
|-----------|----------|------------|-------------|
| **OpenClaw Bridge** | `src/` | Rust | Daemon connecting Webhook to OpenClaw Gateway |
| **Cloudflare Workers Webhook** | `cloudflare-webhook/` | Hono + DO | Production WebSocket service |
| **Web App** | `openclaw-app/` | Next.js 16 + OpenNext | Mobile-optimized web interface |
| **WeChat Mini-Program** | `openclaw-mapp/` | Taro + React | WeChat mini-program frontend |

### OpenClaw Bridge Features

- **High Performance**: Async I/O, type-safe, zero-cost abstractions
- **Lightweight**: ~2.7MB binary size (stripped), 2-3MB memory usage
- **Cross-platform**: Linux, macOS, Windows
- **Reliable Connection**: Auto-reconnect, exponential backoff, session persistence
- **Multi-instance Support**: UID routing for multiple bridge instances

### openclaw-app Features

- **Mobile-optimized**: Responsive design, touch-friendly, safe area insets
- **Core Pages**:
  - Chat - Streaming conversation interface with session management
  - Settings - Gateway URL and connection configuration

## Quick Start

### Prerequisites

- OpenClaw Gateway running locally (default port 18789)
- Config location: `~/.openclaw/`

### Install Bridge

#### Pre-built Binaries

Download binaries for your platform from [Releases](https://github.com/sternelee/openclaw-run/releases).

#### Build from Source

```bash
git clone https://github.com/sternelee/openclaw-run.git
cd openclaw-run
cargo build --release
```

The built binary is located at `target/release/openclaw-bridge`.

### Using Bridge

```bash
# First start (prompts for configuration)
./openclaw-bridge start

# Background start
./openclaw-bridge start

# Daily management
./openclaw-bridge stop      # Stop
./openclaw-bridge restart   # Restart
./openclaw-bridge status    # Check status
./openclaw-bridge run       # Foreground run
```

### Configuration File

Configuration is saved in `~/.openclaw/bridge.json`:

```json
{
  "webhook_url": "ws://localhost:8787/ws",
  "agent_id": "main",
  "uid": "auto-generated-uuid-v4"
}
```

### Logging

```bash
tail -f ~/.openclaw/bridge.log
```

Set log level via `RUST_LOG` environment variable:

```bash
RUST_LOG=info ./openclaw-bridge run     # Default
RUST_LOG=debug ./openclaw-bridge run    # Verbose
RUST_LOG=warn ./openclaw-bridge run    # Quiet
```

## Cloudflare Workers Webhook

```bash
cd cloudflare-webhook
pnpm install
pnpm dev      # Local development
pnpm deploy   # Deploy to Cloudflare
pnpm tail     # Real-time logs
```

## openclaw-app

```bash
cd openclaw-app
pnpm install
pnpm dev          # Local development (localhost:3000)
pnpm build        # Build for production
pnpm deploy       # Deploy to Cloudflare (OpenNext)
```

## openclaw-mapp (WeChat Mini-Program)

```bash
cd openclaw-mapp
pnpm install
pnpm dev:weapp    # Development
```

Import the `dist/` directory in WeChat Developer Tools.

## WebSocket Protocol

### Client Message Format

```json
{
  "id": "unique-message-id",
  "content": "User message content",
  "session": "optional-session-id"
}
```

### Server Response Format

**Streaming Update (progress)**
```json
{
  "type": "progress",
  "content": "Current response content",
  "session": "session-id"
}
```

**Complete (complete)**
```json
{
  "type": "complete",
  "content": "Final response content",
  "session": "session-id"
}
```

## UID Routing Mechanism

All WebSocket connections use UID (Unique Identifier) for routing:

1. Bridge auto-generates UUID v4 on startup
2. Client appends `?uid=xxx` query parameter when connecting
3. Durable Object uses `Map<UID, Set<WebSocket>>` for internal routing

This allows multiple bridge instances to connect to the same webhook server.

## Development

```bash
# Bridge
make fmt        # Format code
make clippy     # Lint checks
make lint       # fmt + clippy
make test       # Run tests
make build      # Build for current platform
make build-all  # Build for all platforms
```

## Event Handling

The bridge correctly handles these OpenClaw Gateway events:

- **agent**: AI streaming response events (lifecycle, assistant, tool)
- **chat**: Chat message events (delta, final, error)
- **event**: System events (ticket, heartbeat, heart, etc.)
- Other event types are passed through with logging

## Contributing

Issues and Pull Requests are welcome!

## License

MIT License - see [LICENSE](LICENSE) file for details

## Related Projects

- [OpenClaw Gateway](https://github.com/openclaw/gateway) - AI Agent Gateway
- [openclaw/ui](https://github.com/openclaw/ui) - Reference Web UI implementation
