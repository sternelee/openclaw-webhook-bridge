# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenClaw is an AI assistant system with three main components:

1. **Go Bridge** (`cmd/bridge/main.go`) - Production daemon connecting webhook to OpenClaw Gateway
2. **Cloudflare Workers Webhook** (`cloudflare-webhook/`) - Durable Object-based WebSocket service with Hono
3. **WeChat Mini-Program** (`openclaw-mapp/`) - Taro-based React client for chatting with OpenClaw

### System Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│ WeChat Mini-    │◄──────────────────►│ Cloudflare       │
│ Program (Taro)  │    (ws://...?uid)  │ Workers Webhook  │
└─────────────────┘                     └────────┬─────────┘
                                                │
                                                │ Durable Object
                                                │ (single global,
                                                │  routes by UID)
                                                ▼
                                       ┌──────────────────┐
                                       │ Go Bridge         │
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

## Component 1: Go Bridge

The Go bridge is a production daemon that connects the webhook service to the OpenClaw AI Agent Gateway.

### Go Bridge Architecture

The bridge consists of five main components:

1. **Webhook Client** (`internal/webhook/client.go`) - WebSocket client for the webhook server. Appends `uid` query parameter for instance identification. Handles incoming JSON messages and forwards OpenClaw responses back.

2. **OpenClaw Client** (`internal/openclaw/client.go`) - WebSocket client for OpenClaw Gateway (localhost). Implements the gateway protocol handshake:
   - Sends `connect` request with auth token, protocol version (3), and operator scopes
   - Sends `agent` requests with message, agentId, sessionKey, and idempotency key
   - Receives streaming events: `assistant`, `thought`, `tool_call`, `tool_result`, `lifecycle`

3. **Bridge Core** (`internal/bridge/bridge.go`) - Central routing logic that:
   - Parses webhook messages for `id`, `content`, and optional `session`
   - Filters control messages (type=`connected`, `error`, `event`)
   - Generates session key as `webhook:{messageID}` when session not provided
   - Forwards user content to OpenClaw as agent requests
   - Forwards OpenClaw events back to webhook as raw JSON

4. **Config Loader** (`internal/config/config.go`) - Configuration from `~/.openclaw/`:
   - `openclaw.json` - Gateway port (default 18789) and auth token
   - `bridge.json` - Webhook URL, agent ID (default "main"), and optional UID
   - `sessions.json` - Session store (auto-created)

5. **Session Store** (`internal/sessions/`) - File-based session persistence:
   - `types.go` - SessionEntry, DeliveryContext, SessionScope
   - `store.go` - File persistence with in-memory cache (45s TTL) and file locking
   - `session_key.go` - Session key derivation (per-sender vs global)
   - Reset triggers: `/new`, `/reset` commands create fresh sessions

The UID is mandatory for routing - auto-generated UUID v4 if not provided.

### Go Bridge Build Commands

```bash
# Build current platform
make build
# or
go build -o openclaw-bridge ./cmd/bridge/

# Build all platforms (Linux, macOS, Windows)
make build-all
# or
./scripts/build.sh

# Run in dev mode (foreground)
make dev
# or
go run ./cmd/bridge/

# Run as daemon
./openclaw-bridge start webhook_url=ws://localhost:8080/ws
./openclaw-bridge status
./openclaw-bridge stop
./openclaw-bridge restart

# Tests
make test

# Code quality
make fmt      # go fmt ./...
make vet      # go vet ./...
make lint     # fmt + vet
make tidy     # go mod tidy
```

## Component 2: Cloudflare Workers Webhook

The webhook service is built with Cloudflare Workers and Durable Objects, providing stateful WebSocket connections with hibernation support.

### Webhook Architecture

- **Entry Point** (`cloudflare-webhook/src/index.ts`) - Hono-based HTTP/WebSocket router with test page
- **Durable Object** (`cloudflare-webhook/src/websocket-hub.ts`) - Single global DO with UID-based routing using hibernation API
- **WebSocket Protocol**:
  - Accepts both `/ws?uid=xxx` and `/ws/:uid` path patterns
  - Rejects connections without UID (returns 400 error)
  - Routes messages to bridge instances based on UID within a single global Durable Object
  - Uses `state.acceptWebSocket()` and `state.getWebSockets()` for hibernation
  - Broadcasts messages from clients to other clients with the same UID (multi-client sync)

### Webhook Build Commands

```bash
cd cloudflare-webhook

# Install dependencies
pnpm install

# Local development (wrangler dev server)
pnpm dev
# or
wrangler dev

# Deploy to Cloudflare
pnpm deploy
# or
wrangler deploy

# Tail real-time logs
pnpm tail
# or
wrangler tail

# Type check
tsc --noEmit
```

### Webhook Configuration

Edit `wrangler.toml` to configure:
- Worker name and route
- Durable Object bindings
- Environment variables

## Component 3: WeChat Mini-Program

The mini-program is built with Taro (React-based framework) for WeChat, providing a chat interface to OpenClaw.

### Mini-Program Architecture

- **Framework**: Taro 4.x with React 18 and TypeScript
- **State Management**: MobX 4.x with `@observable` and `@action` decorators
- **Pages**:
  - `pages/chat/index.tsx` - Main chat interface with streaming support
  - `pages/settings/index.tsx` - Server configuration (wsUrl, uid)
  - `pages/welcome/index.tsx` - Welcome/onboarding page
- **Components**:
  - `ChatHeader` - Connection status and action buttons
  - `ChatInput` - Message input with send button
  - `MessageGroup` - Grouped message display
  - `SettingsModal` - In-place settings modal
  - `TypingIndicator` - Streaming status indicator
- **Services**:
  - `services/websocket.ts` - WebSocket client with UID-based routing
  - `store/chatStore.ts` - MobX store for messages and connection state
- **Markdown Rendering**: towxml integration for assistant messages

### Mini-Program Build Commands

```bash
cd openclaw-mapp

# Install dependencies
pnpm install

# Development build with watch mode
pnpm dev:weapp
# or
npm run dev:weapp

# Production build
pnpm build:weapp
# or
npm run build:weapp

# Type check (no emit)
pnpm typescript
# or
npm run typescript
```

### Mini-Program Configuration

- **Entry Config**: `src/app.config.ts` - Page routes, global styles, component registration
- **Global Styles**: `src/app.scss` - SCSS variables and global styles
- **Taro Config**: `config/index.js` - Build configuration for WeChat platform

### Important: MobX Observable Pattern

When adding state to components or stores in the mini-program, **always use `@observable` decorator** for reactive properties. Using `private` properties will NOT trigger re-rendering:

```typescript
import { observable } from "mobx";

class SettingsPage extends Component {
  // CORRECT - Input will be editable
  @observable wsUrlInput: string = "";

  // WRONG - Input will not update when typing
  private wsUrlInput: string = "";
}
```

## Running the Complete System

### Node.js Webhook Server (Local Testing)

For local testing without Cloudflare, use the Node.js webhook server:

```bash
cd node-webhook
npm install
npm start
```

Then connect the Go bridge to `ws://localhost:8080/ws`. A test page is available at `http://localhost:8080`.

### Full System Startup Sequence

1. **Start OpenClaw Gateway** (external service, typically runs on localhost:18789)

2. **Deploy Cloudflare Workers Webhook**:
   ```bash
   cd cloudflare-webhook
   pnpm deploy
   ```

3. **Start Go Bridge**:
   ```bash
   ./openclaw-bridge start webhook_url=wss://your-worker.workers.dev/ws
   ```

4. **Build and Run Mini-Program**:
   ```bash
   cd openclaw-mapp
   pnpm dev:weapp
   # Open WeChat Developer Tools and import the dist/ directory
   ```

5. **Configure Mini-Program**:
   - Open the mini-program
   - Go to Settings page
   - Enter WebSocket URL (e.g., `wss://your-worker.workers.dev`)
   - Enter Bridge UID (check `~/.openclaw/bridge.json` or bridge logs)
   - Tap "Connect Server"

## UID-Based Routing System

All WebSocket connections in this system use UID (Unique Identifier) based routing for multi-instance support:

1. **Bridge UID**: Auto-generated UUID v4 stored in `~/.openclaw/bridge.json`
2. **Mini-Program Config**: User enters the Bridge UID in settings page
3. **WebSocket Connection**: Mini-program appends `?uid=xxx` when connecting
4. **Durable Object**: Cloudflare Worker uses a single global Durable Object that routes messages by UID internally
5. **Message Routing**: The DO maintains a `Map<UID, Set<WebSocket>>` for routing messages to specific bridge instances

This design allows multiple bridges and multiple clients to connect to the same webhook server without conflicts, with efficient hibernation support.

## Key Design Decisions

- **Streaming Response Support**: The mini-program supports streaming AI responses via WebSocket. Messages with `type: "progress"` update the UI incrementally, while `type: "complete"` finalizes the response. The chat store tracks `streaming` state and `currentStreamingMessage` for UI feedback.

- **Message Grouping**: Consecutive messages from the same role (user/assistant) are grouped together in the UI for cleaner display. Both the store (`groupedMessages` computed) and component (`groupMessages` method) implement this pattern.

- **Session key resolution**:
  - `per-sender` scope (default): Each webhook message gets `webhook:{id}` session key for isolated conversations
  - `global` scope: All messages share a single `global` session
  - Explicit session: If webhook message provides `session` field, it overrides the generated key

- **Delivery context tracking**: Each session tracks `lastChannel`, `lastTo`, `lastAccountId`, `lastThreadId` for proper response routing. This allows the bridge to route responses back to the correct webhook client.

- **Session reset triggers**: Messages matching `/new` or `/reset` trigger session reset (fresh conversation context). The session preserves its delivery context but starts with a new `sessionId`.

- **Control message filtering**: The bridge ignores webhook control payloads with `type` values like `connected`, `error`, or `event`. These are internal WebSocket protocol messages, not user content.

- **Mandatory UID routing**: The bridge requires a UID (unique identifier) to append as a query parameter when connecting to the webhook server (`?uid=...`). This allows webhook servers to distinguish between multiple bridge instances. If not provided in config, a UUID v4 is auto-generated and saved.

- **Persistent connections with auto-reconnect**: Both WebSocket clients (webhook and OpenClaw) run connection loops with exponential backoff reconnection delays. The bridge survives temporary network failures.

## File Structure Reference

```
openclaw-webhook-bridge/
├── cmd/bridge/              # Go bridge entry point
│   ├── main.go              # CLI and daemon management
│   ├── daemon_unix.go       # Unix daemon implementation
│   └── daemon_windows.go    # Windows daemon implementation
├── internal/
│   ├── bridge/              # Core routing logic
│   ├── config/              # Configuration loader
│   ├── openclaw/            # OpenClaw Gateway client
│   ├── sessions/            # Session persistence
│   └── webhook/             # Webhook server client
├── cloudflare-webhook/      # Cloudflare Workers webhook (Hono + Durable Objects)
│   ├── src/
│   │   ├── index.ts         # Hono router with test page
│   │   └── websocket-hub.ts # Durable Object with UID routing
│   ├── wrangler.toml        # Worker configuration
│   └── package.json
├── node-webhook/            # Local Node.js WebSocket server for testing
│   ├── server.js            # WebSocket server
│   ├── test-page.html       # Test page UI
│   └── package.json
├── openclaw-mapp/           # WeChat mini-program
│   ├── src/
│   │   ├── app.tsx          # App entry point
│   │   ├── app.config.ts    # Page routes, component registration
│   │   ├── components/      # Reusable components
│   │   │   ├── towxml-build/ # Markdown rendering library
│   │   │   ├── ChatHeader/
│   │   │   ├── ChatInput/
│   │   │   ├── Message/
│   │   │   ├── SettingsModal/
│   │   │   └── TypingIndicator/
│   │   ├── pages/           # Page components
│   │   │   ├── chat/
│   │   │   ├── settings/
│   │   │   └── welcome/
│   │   ├── services/        # WebSocket service
│   │   ├── store/           # MobX stores
│   │   └── types/           # TypeScript definitions
│   ├── config/              # Taro build config
│   └── package.json
├── Makefile                 # Go build commands
├── go.mod, go.sum           # Go dependencies
└── README.md                # User-facing documentation
```

## Platform-Specific Code

The Go bridge uses platform-specific files for daemonization:

- `cmd/bridge/daemon_unix.go` - Unix daemon (sets `Setpgid: true` on process attributes)
- `cmd/bridge/daemon_windows.go` - Windows daemon (no special flags needed)

When adding daemon-related changes, ensure both platforms are handled.

## WebSocket Protocol Details

### Mini-Program → Webhook (incoming)

The mini-program sends JSON messages to the webhook:

```json
{
  "id": "unique-message-id",
  "content": "user message",
  "session": "optional-session-id"
}
```

The connection URL must include the Bridge UID:
```
wss://worker.workers.dev/ws?uid=<bridge-uid>
```

### Webhook → Bridge (incoming)

Same format as mini-program messages. Control messages with `type` field are filtered out.

### Webhook → Mini-Program (streaming response)

The webhook/bridge sends streaming responses back to the mini-program:

**Progress (streaming):**
```json
{
  "type": "progress",
  "content": "partial response text...",
  "session": "session-id"
}
```

**Complete:**
```json
{
  "type": "complete",
  "content": "final response text",
  "session": "session-id"
}
```

**Error:**
```json
{
  "type": "error",
  "error": "error message"
}
```

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
