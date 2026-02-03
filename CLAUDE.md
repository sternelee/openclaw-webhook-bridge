# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenClaw Bridge is a Go service that connects Chinese IM platforms (Feishu/Lark) with the OpenClaw AI Agent Gateway. It acts as a WebSocket bridge between Feishu's WebSocket API and OpenClaw's local WebSocket gateway.

## Architecture

The bridge has four main components:

1. **Feishu Client** (`internal/feishu/client.go`) - WebSocket client for Feishu/Lark events using the official oapi-sdk-go v3 SDK. Handles incoming messages and provides methods to send/update/delete messages.

2. **OpenClaw Client** (`internal/openclaw/client.go`) - WebSocket client for OpenClaw Gateway (local). Implements the gateway protocol: connect challenge → connect → agent request → stream events (assistant, thought, tool_call, tool_result, lifecycle).

3. **Bridge** (`internal/bridge/bridge.go`) - Core logic that:
   - Routes messages from Feishu to OpenClaw
   - Manages session keys per chat (format: `feishu:{chatID}`)
   - Deduplicates messages using a TTL cache (10 minutes)
   - Handles group chat trigger detection (mentions, question marks, action verbs, bot names)
   - Optionally shows "thinking..." placeholder if response takes longer than `thinking_ms`
   - Handles `NO_REPLY` responses from OpenClaw (suppresses sending messages)

4. **Config** (`internal/config/config.go`) - Loads configuration from:
   - `~/.openclaw/openclaw.json` or `~/.openclaw/openclaw.json` (gateway config)
   - `~/.openclaw/bridge.json` (bridge config - Feishu credentials)

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
# First-time setup with Feishu credentials
./openclaw-bridge start fs_app_id=cli_xxx fs_app_secret=yyy

# Subsequent runs (credentials saved)
./openclaw-bridge start   # Start as daemon
./openclaw-bridge stop    # Stop
./openclaw-bridge status  # Check status
./openclaw-bridge run     # Run in foreground (for debugging)
```

Logs are written to `~/.openclaw/bridge.log`.

## Key Design Decisions

- **Circular dependency resolution**: The Bridge needs both FeishuClient and OpenClawClient, but OpenClawClient doesn't need FeishuClient. The main creates Bridge with `nil` FeishuClient first, then calls `SetFeishuClient()` after FeishuClient is constructed.

- **Session management**: Each Feishu chat gets a unique session key `feishu:{chatID}` in OpenClaw, enabling conversation continuity per chat.

- **Message deduplication**: Feishu may deliver the same message multiple times. The bridge uses a 10-minute TTL cache to skip duplicate processing.

- **Group chat triggers**: In group chats, the bot only responds when:
  - Mentioned (@bot)
  - Message ends with "?" or "？"
  - Contains question words (why, how, what, etc.)
  - Contains Chinese action verbs (帮, 麻烦, 请, etc.)
  - Message starts with bot name triggers (alen, openclaw, bot, 助手, 智能体)

- **"Thinking..." placeholder**: If `thinking_ms > 0`, the bridge shows "正在思考…" after the threshold, then updates that message with the actual response. This avoids UI flicker for fast responses.

## Dependencies

- `github.com/larksuite/oapi-sdk-go/v3` - Feishu/Lark SDK
- `github.com/gorilla/websocket` - WebSocket client for OpenClaw Gateway
- `github.com/google/uuid` - Idempotency keys for agent requests
