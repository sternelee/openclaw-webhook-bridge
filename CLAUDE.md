# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenClaw Bridge is a Go service that connects a generic WebSocket webhook service with the OpenClaw AI Agent Gateway. It acts as a WebSocket bridge between a webhook server and OpenClaw's local WebSocket gateway.

## Architecture

The bridge has four main components:

1. **Webhook Client** (`internal/webhook/client.go`) - WebSocket client for the webhook server. Handles incoming JSON messages and forwards OpenClaw responses back to the webhook.

2. **OpenClaw Client** (`internal/openclaw/client.go`) - WebSocket client for OpenClaw Gateway (local). Implements the gateway protocol: connect challenge → connect → agent request → stream events (assistant, thought, tool_call, tool_result, lifecycle).

3. **Bridge** (`internal/bridge/bridge.go`) - Core logic that:
   - Routes messages from the webhook to OpenClaw
   - Skips control messages (`connected`, `error`, `event`)
   - Creates session keys when missing (format: `webhook:{messageID}`)

4. **Config** (`internal/config/config.go`) - Loads configuration from:
   - `~/.openclaw/openclaw.json` (gateway config)
   - `~/.openclaw/bridge.json` (bridge config - webhook URL, agent ID, UID)

## Build Commands

```bash
# Build current platform
make build
# or
go build -o openclaw-bridge ./cmd/bridge/

# Build all platforms
make build-all
# or
./scripts/build.sh

# Run in dev mode
make dev
# or
go run ./cmd/bridge/

# Test
make test

# Format and lint
make fmt
make vet
make lint
```

## Running the Bridge

```bash
# First-time setup with webhook URL
./openclaw-bridge start webhook_url=ws://localhost:8080/ws

# Subsequent runs (config saved)
./openclaw-bridge start   # Start as daemon
./openclaw-bridge stop    # Stop
./openclaw-bridge status  # Check status
./openclaw-bridge run     # Run in foreground (for debugging)
```

Logs are written to `~/.openclaw/bridge.log`.

## Key Design Decisions

- **Session management**: Each incoming webhook message uses `session` if provided; otherwise the bridge generates `webhook:{messageID}` to keep OpenClaw conversations isolated.

- **Control message filtering**: The bridge ignores webhook control payloads with `type` values like `connected`, `error`, or `event`.

## Dependencies

- `github.com/gorilla/websocket` - WebSocket client for webhook and OpenClaw Gateway
- `github.com/google/uuid` - Idempotency keys for agent requests
