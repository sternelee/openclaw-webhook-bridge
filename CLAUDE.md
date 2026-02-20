# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenClaw is an AI assistant system with multiple implementations and components:

1. **OpenClaw Bridge** (`src/main.rs`) - Production daemon connecting webhook to OpenClaw Gateway (Rust implementation with async I/O and excellent performance)
2. **Cloudflare Workers Webhook** (`cloudflare-webhook/`) - Durable Object-based WebSocket service with Hono
3. **WeChat Mini-Program** (`openclaw-mapp/`) - Taro-based React client for chatting with OpenClaw
4. **Next.js Web App** (`openclaw-app/`) - Web client using OpenNext for Cloudflare deployment

The Bridge is implemented in Rust for better performance, memory safety, and smaller binary size (~2.7MB).

### System Architecture

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
                                               │ Durable Object
                                               │ (single global,
                                               │  routes by UID)
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

## Bridge Architecture

The Bridge consists of five main components:

1. **Webhook Client** (`src/webhook/mod.rs`) - WebSocket client for the webhook server. Appends `uid` query parameter for instance identification. Handles incoming JSON messages and forwards OpenClaw responses back.

2. **OpenClaw Client** (`src/openclaw/mod.rs`) - WebSocket client for OpenClaw Gateway (localhost). Implements the gateway protocol handshake:
   - Sends `connect` request with auth token, protocol version (3), and operator scopes
   - Sends `agent` requests with message, agentId, sessionKey, and idempotency key
   - Receives streaming events: `assistant`, `thought`, `tool_call`, `tool_result`, `lifecycle`

3. **Bridge Core** (`src/bridge/mod.rs`) - Central routing logic that:
   - Parses webhook messages for `id`, `content`, and optional `session`
   - Filters control messages (type=`connected`, `error`, `event`)
   - Generates session key as `webhook:{messageID}` when session not provided
   - Forwards user content to OpenClaw as agent requests
   - Forwards OpenClaw events back to webhook as raw JSON

4. **Config Loader** (`src/config/mod.rs`) - Configuration from `~/.openclaw/`:
   - `openclaw.json` - Gateway port (default 18789) and auth token
   - `bridge.json` - Webhook URL, agent ID (default "main"), and optional UID
   - `sessions.json` - Session store (auto-created)

5. **Session Store** (`src/sessions/mod.rs`) - File-based session persistence:
   - Types: SessionEntry, DeliveryContext, SessionScope
   - File persistence with in-memory cache (45s TTL) and file locking
   - Session key derivation (per-sender vs global)
   - Reset triggers: `/new`, `/reset` commands create fresh sessions

The UID is mandatory for routing - auto-generated UUID v4 if not provided.

### Rust Code Style

- **Formatting**: `rustfmt` (4 spaces, standard Rust style)
- **Error handling**: Use `anyhow::Result` for application code, `thiserror` for libraries, propagate with `?`
- **Async**: `tokio` runtime, use `async/await`, propagate cancellation via `tokio::select!`
- **Logging**: `log` crate with component prefixes: `[Bridge]`, `[Webhook]`, `[OpenClaw]`, `[Session]`
- **IMPORTANT**: Never log message content (privacy) - log receipt only

### Build Commands

```bash
# Debug build
cargo build

# Release build (optimized, stripped)
cargo build --release
# or
make build-release

# Run in foreground
cargo run -- run
# or
make run

# Cross-platform builds (requires cross)
make build-all-release

# Linting
make fmt      # cargo fmt
make clippy   # cargo clippy
make lint     # fmt + clippy

# Testing
make test     # cargo test

# Single test
cargo test test_session_key

# Run tests in package
cd src/sessions && cargo test

# Show test output
cargo test -- --nocapture

# Fast syntax/type check
cargo check
```

### Logging

Set log level via `RUST_LOG` environment variable:
```bash
RUST_LOG=info cargo run -- run    # Default
RUST_LOG=debug cargo run -- run   # Verbose
RUST_LOG=warn cargo run -- run    # Quiet
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

### TypeScript Code Style (Cloudflare Workers)

- Strict mode enabled, ES2022, 2 spaces, semicolons
- Export `interface Env` for Durable Object bindings
- Type-safe Hono routing: `Hono<{ Bindings: Env }>()`

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

# Run tests
pnpm test
```

### Webhook Configuration

Edit `wrangler.toml` to configure:
- Worker name and route
- Durable Object bindings
- Environment variables

## Component 3: WeChat Mini-Program

The mini-program is built with Taro (React-based framework) for WeChat, providing a chat interface to OpenClaw.

**Important**: Use `pnpm` NOT npm for this package due to Tailwind CSS patch scripts.

### Mini-Program Architecture

- **Framework**: Taro 4.x with React 18 and TypeScript
- **State Management**: MobX 4.x with `@observable` and `@action` decorators
- **Target**: ES2017 (WeChat compatibility), `jsx: react-jsx`
- **TypeScript**: `strict: false` (legacy Taro compatibility)
- **Path Alias**: Use `@/` alias for `./src/*`
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

# Production build
pnpm build:weapp

# Type check (no emit)
pnpm typescript
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

## Component 4: Next.js Web App

The web app is built with Next.js 16 and React 19, designed for deployment on Cloudflare Workers via OpenNext.

### Web App Architecture

- **Framework**: Next.js 16 with React 19 and TypeScript
- **Deployment**: OpenNext for Cloudflare Workers (`@opennextjs/cloudflare`)
- **State Management**: Zustand (`src/store/use-app-store.ts`)
- **Styling**: Tailwind CSS v4 with Radix UI components
- **Pages** (simplified structure):
  - `src/app/chat/page.tsx` - Main chat interface with streaming support
  - `src/app/settings/page.tsx` - Gateway configuration
  - `src/app/page.tsx` - Redirects to `/chat`
- **Key Files**:
  - `open-next.config.ts` - OpenNext configuration
  - `wrangler.jsonc` - Cloudflare configuration

### TypeScript/React Code Style (openclaw-app)

- Next.js 16 with React 19, App Router
- Zustand for state management (`use-app-store.ts`)
- Tailwind CSS v4 with Radix UI components
- Deployed via OpenNext for Cloudflare Workers

### Web App Build Commands

```bash
cd openclaw-app

# Install dependencies
pnpm install

# Development server (localhost:3000)
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Deploy to Cloudflare via OpenNext
pnpm deploy

# Preview locally on Cloudflare runtime
pnpm preview
```

### Web App Configuration

- **Next Config**: `next.config.ts` - Standard Next.js configuration with OpenNext dev init
- **OpenNext Config**: `open-next.config.ts` - OpenNext-specific Cloudflare settings
- **Wrangler Config**: `wrangler.jsonc` - Cloudflare Worker bindings and environment

### Important: Cloudflare Bindings in Development

The app initializes OpenNext Cloudflare bindings for development in `next.config.ts`. This enables `getCloudflareContext()` calls during local development. See [OpenNext documentation](https://opennext.js.org/cloudflare/bindings#local-access-to-bindings) for details.

## Running the Complete System

### Node.js Webhook Server (Local Testing)

For local testing without Cloudflare, use the Node.js webhook server:

```bash
cd node-webhook
npm install
npm start    # Starts on localhost:8787
```

Then connect the bridge to `ws://localhost:8787/ws`. A test page is available at `http://localhost:8787`.

### Full System Startup Sequence

1. **Start OpenClaw Gateway** (external service, typically runs on localhost:18789)

2. **Deploy Cloudflare Workers Webhook**:
   ```bash
   cd cloudflare-webhook
   pnpm deploy
   ```

3. **Start Bridge**:
   ```bash
   ./openclaw-bridge start webhook_url=wss://your-worker.workers.dev/ws
   ```

4. **Optionally build and run clients**:

   **WeChat Mini-Program**:
   ```bash
   cd openclaw-mapp
   pnpm dev:weapp
   # Open WeChat Developer Tools and import the dist/ directory
   ```

   **Next.js Web App**:
   ```bash
   cd openclaw-app
   pnpm dev          # Local development on localhost:3000
   # or
   pnpm deploy       # Deploy to Cloudflare via OpenNext
   ```

5. **Configure client**:
   - For Mini-Program: Go to Settings page, enter WebSocket URL and Bridge UID, tap "Connect Server"
   - For Web App: Configure connection through the UI (implementation varies by app state)

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

- **Command handling**: The bridge supports slash commands (`/help`, `/commands`, `/skill`, `/approve`) that are intercepted and handled locally or forwarded to OpenClaw Gateway. Commands are detected by leading `/` and parsed by `src/commands/mod.rs`.

- **Control message filtering**: The bridge ignores webhook control payloads with `type` values like `connected`, `error`, or `event`. These are internal WebSocket protocol messages, not user content.

- **Mandatory UID routing**: The bridge requires a UID (unique identifier) to append as a query parameter when connecting to the webhook server (`?uid=...`). This allows webhook servers to distinguish between multiple bridge instances. If not provided in config, a UUID v4 is auto-generated and saved.

- **Persistent connections with auto-reconnect**: Both WebSocket clients (webhook and OpenClaw) run connection loops with exponential backoff reconnection delays. The bridge survives temporary network failures.

## Key Conventions

- **UID Routing**: All WebSocket connections MUST include `?uid=xxx` query param
- **Session Isolation**: Each session key maintains independent context
- **Secrets**: Never commit tokens/API keys - use env vars or config files (`~/.openclaw/`)
- **Concurrency**: Use `tokio::sync` (Rust) for shared state
- **WebSocket Reconnect**: Exponential backoff 2s → 4s → 8s → max 30s

## File Structure Reference

```
openclaw-run/
├── src/                     # Rust implementation
│   ├── main.rs              # CLI entry point
│   ├── bridge/              # Core routing logic
│   ├── commands/            # Command handling
│   ├── config/              # Configuration management
│   ├── openclaw/            # OpenClaw Gateway client
│   ├── sessions/            # Session management
│   └── webhook/             # Webhook WebSocket client
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
│   │   ├── pages/           # Page components
│   │   ├── services/        # WebSocket service
│   │   ├── store/           # MobX stores
│   │   └── types/           # TypeScript definitions
│   ├── config/              # Taro build config
│   └── package.json
├── openclaw-app/            # Next.js web app (OpenNext for Cloudflare)
│   ├── src/
│   │   └── app/             # Next.js app directory
│   ├── open-next.config.ts  # OpenNext configuration
│   ├── next.config.ts       # Next.js configuration
│   └── package.json
├── Makefile                 # Build commands
├── Cargo.toml               # Rust project manifest
├── CLAUDE.md                # This file - AI agent guidance
├── AGENTS.md                # Additional AI agent guidelines
├── COMMANDS.md              # Slash commands feature documentation
├── RUST_README.md           # Rust implementation guide
├── SESSION_CONTROL.md       # Session control protocol documentation
└── README.md                # User-facing documentation
```

## Slash Commands

The bridge supports local slash commands that are intercepted before forwarding to OpenClaw:

- `/help` - Show available commands
- `/commands` - List all OpenClaw Gateway commands (fetched via `system.listCommands`)
- `/skill [name]` - List or run skills
- `/approve [id] [yes|no]` - Approve/deny pending requests

Commands are detected by the leading `/` and handled by `src/commands/mod.rs`. See `COMMANDS.md` for full protocol details.

## WebSocket Protocol Details

### Client → Webhook (incoming)

Clients (Mini-Program, Web App, or other) send JSON messages to the webhook:

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

### Webhook → Client (streaming response)

The webhook/bridge sends streaming responses back to clients (Mini-Program, Web App, etc):

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
