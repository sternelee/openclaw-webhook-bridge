# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenClaw Bridge is a WebSocket service that connects a generic webhook service with the OpenClaw AI Agent Gateway. It exists in two implementations with identical behavior:

1. **Go Bridge** (`cmd/bridge/main.go`) - Production daemon with auto-reconnect and PID management
2. **TypeScript Bridge** (`ts-bridge/`) - Bun-based alternative for development/testing

## Architecture

Both bridges share the same four-component architecture:

### 1. Webhook Client
- Go: `internal/webhook/client.go`
- TS: `ts-bridge/src/webhook/client.ts`

WebSocket client for the webhook server. Appends `uid` query parameter when connecting for instance identification. Handles incoming JSON messages and forwards OpenClaw responses back.

### 2. OpenClaw Client
- Go: `internal/openclaw/client.go`
- TS: `ts-bridge/src/openclaw/client.ts`

WebSocket client for OpenClaw Gateway (localhost). Implements the gateway protocol handshake:
- Sends `connect` request with auth token, protocol version (3), and operator scopes
- Sends `agent` requests with message, agentId, sessionKey, and idempotency key
- Receives streaming events: `assistant`, `thought`, `tool_call`, `tool_result`, `lifecycle`

### 3. Bridge Core
- Go: `internal/bridge/bridge.go`
- TS: `ts-bridge/src/bridge.ts`

Central routing logic:
- Parses webhook messages for `id`, `content`, and optional `session`
- Filters control messages (type=`connected`, `error`, `event`)
- Generates session key as `webhook:{messageID}` when session not provided
- Forwards user content to OpenClaw as agent requests
- Forwards OpenClaw events back to webhook as raw JSON

### 4. Config Loader
- Go: `internal/config/config.go`
- TS: `ts-bridge/src/config.ts`

Configuration from `~/.openclaw/`:
- `openclaw.json` - Gateway port (default 18789) and auth token
- `bridge.json` - Webhook URL, agent ID (default "main"), and optional UID
- `sessions.json` - Session store (auto-created, contains session state and routing info)

The UID is mandatory for routing - auto-generated UUID v4 if not provided.

### 5. Session Store (Go only)
- Go: `internal/sessions/`

File-based session persistence following OpenClaw's patterns:
- **Session types**: `types.go` - SessionEntry, DeliveryContext, SessionScope
- **Store**: `store.go` - File persistence with in-memory cache (45s TTL) and file locking
- **Key resolution**: `session_key.go` - Session key derivation (per-sender vs global)
- **Reset triggers**: `/new`, `/reset` commands create fresh sessions

## Build Commands

```bash
# Go bridge - build current platform
make build
# or
go build -o clawdbot-bridge ./cmd/bridge/

# Go bridge - build all platforms
make build-all
# or
./scripts/build.sh

# Go bridge - run in dev mode
make dev
# or
go run ./cmd/bridge/

# TypeScript bridge - run with Bun
cd ts-bridge && bun install
bun run src/cli.ts run webhook_url=ws://localhost:8080/ws

# Tests (Go)
make test
# or
go test -v ./...

# Code quality
make fmt      # go fmt ./...
make vet      # go vet ./...
make lint     # fmt + vet
make tidy     # go mod tidy
```

## Running the Go Bridge

```bash
# First-time setup with webhook URL
./clawdbot-bridge start webhook_url=ws://localhost:8080/ws

# Subsequent runs (config saved to ~/.openclaw/bridge.json)
./clawdbot-bridge start   # Start as daemon
./clawdbot-bridge stop    # Stop
./clawdbot-bridge status  # Check status
./clawdbot-bridge restart # Restart
./clawdbot-bridge run     # Run in foreground (for debugging)
```

Daemon logs are written to `~/.openclaw/bridge.log`. PID file is `~/.openclaw/bridge.pid`.

## Running the TypeScript Bridge

```bash
cd ts-bridge
bun install
bun run src/cli.ts start webhook_url=ws://localhost:8080/ws
```

The TS bridge runs in the foreground only (no daemon mode). Use Ctrl+C to stop.

## Key Design Decisions

- **Session synchronization**: The bridge maintains a session store (`~/.openclaw/sessions.json`) that tracks session state, delivery context, and routing information. Sessions are persisted across restarts with a 45-second in-memory cache for performance. File locking ensures concurrent access safety.

- **Session key resolution**:
  - `per-sender` scope (default): Each webhook message gets `webhook:{id}` session key for isolated conversations
  - `global` scope: All messages share a single `global` session
  - Explicit session: If webhook message provides `session` field, it overrides the generated key

- **Delivery context tracking**: Each session tracks `lastChannel`, `lastTo`, `lastAccountId`, `lastThreadId` for proper response routing. This allows the bridge to route responses back to the correct webhook client.

- **Session reset triggers**: Messages matching `/new` or `/reset` trigger session reset (fresh conversation context). The session preserves its delivery context but starts with a new `sessionId`.

- **Control message filtering**: The bridge ignores webhook control payloads with `type` values like `connected`, `error`, or `event`. These are internal WebSocket protocol messages, not user content.

- **Mandatory UID routing**: The bridge requires a UID (unique identifier) to append as a query parameter when connecting to the webhook server (`?uid=...`). This allows webhook servers to distinguish between multiple bridge instances. If not provided in config, a UUID v4 is auto-generated and saved.

- **Persistent connections with auto-reconnect**: Both WebSocket clients (webhook and OpenClaw) run connection loops with exponential backoff reconnection delays. The bridge survives temporary network failures.

## Platform-Specific Code

The Go bridge uses platform-specific files for daemonization:

- `cmd/bridge/daemon_unix.go` - Unix daemon (sets `Setpgid: true` on process attributes)
- `cmd/bridge/daemon_windows.go` - Windows daemon (no special flags needed)

When adding daemon-related changes, ensure both platforms are handled.

## WebSocket Protocol Details

### Webhook → Bridge (incoming)
```json
{
  "id": "unique-message-id",
  "content": "user message",
  "session": "optional-session-id"
}
```
Control messages with `type` field are filtered out.

### Bridge → OpenClaw Gateway
```json
{
  "type": "req",
  "id": "agent:{timestamp}",
  "method": "agent",
  "params": {
    "message": "user message",
    "agentId": "main",
    "sessionKey": "webhook:{message-id}",
    "deliver": true,
    "idempotencyKey": "{timestamp-nanos}"
  }
}
```

### OpenClaw → Bridge → Webhook
Raw JSON events from OpenClaw are forwarded directly to the webhook without transformation.

## Session Control Messages

The bridge supports session control messages via WebSocket. See `SESSION_CONTROL.md` for detailed documentation:

**Quick Reference:**

| Action | Message Type | Example |
|--------|--------------|---------|
| Sync to existing session | Regular message with `session` field | `{"id":"msg-1","content":"Hi","session":"my-key"}` |
| Create new session | Omit `session` field or use `/new` | `{"id":"msg-1","content":"/new"}` |
| Query session | `session.get` | `{"type":"session.get","key":"webhook:msg-1"}` |
| List all sessions | `session.list` | `{"type":"session.list"}` |
| Reset session | `session.reset` | `{"type":"session.reset","key":"webhook:msg-1"}` |
| Delete session | `session.delete` | `{"type":"session.delete","key":"webhook:msg-1"}` |
