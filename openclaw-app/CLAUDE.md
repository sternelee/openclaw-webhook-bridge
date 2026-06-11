# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenClaw Web App is a Next.js 16 application with React 19, designed for deployment on Cloudflare Workers via OpenNext. It provides a chat interface to the OpenClaw AI assistant system, connecting either directly to an OpenClaw Gateway or through a Bridge server.

## Build Commands

```bash
# Install dependencies (use pnpm, NOT npm)
pnpm install

# Development server (localhost:3000)
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Type checking
pnpm typescript
# or
tsc --noEmit

# Linting
pnpm lint

# Deploy to Cloudflare via OpenNext
pnpm deploy

# Preview locally on Cloudflare runtime
pnpm preview

# Upload to Cloudflare (without deploying)
pnpm upload

# Generate Cloudflare types
pnpm cf-typegen
```

## Architecture Overview

### Technology Stack

- **Framework**: Next.js 16 with React 19 (App Router)
- **Deployment**: OpenNext for Cloudflare Workers (`@opennextjs/cloudflare`)
- **State Management**: Zustand 5.x with devtools and persistence middleware
- **Styling**: Tailwind CSS v4 with Radix UI components
- **Language**: TypeScript 5.7 with strict mode enabled
- **Target**: ES2024, bundler module resolution

### Connection Modes

The app supports two connection modes:

1. **Gateway Mode** (direct): Connects to OpenClaw Gateway (typically `localhost:18789`)
2. **Bridge Mode** (webhook): Connects to Bridge server via Cloudflare Workers webhook

Connection mode is auto-detected based on URL pattern:
- URLs containing `:18789`, `localhost`, or `127.0.0.1` → Gateway mode
- All other URLs → Bridge mode

### Key Directories

```
src/
├── app/                    # Next.js App Router pages
│   ├── chat/              # Main chat interface
│   ├── settings/          # Gateway configuration
│   ├── gateway/           # Gateway management page
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout with providers
│   └── globals.css        # Global styles and Tailwind imports
├── components/
│   ├── chat/              # Chat-specific components
│   │   ├── ChatInput.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageGroup.tsx
│   │   ├── StreamingMessage.tsx
│   │   ├── SessionSelector.tsx
│   │   ├── QueueDisplay.tsx
│   │   └── ToolCard.tsx
│   ├── layout/            # Layout components (navigation, sidebar)
│   ├── providers/         # React context providers
│   └── ui/                # Radix UI wrapper components
├── lib/                   # Utility libraries
│   ├── utils-gateway.ts   # GatewayClient WebSocket implementation
│   ├── utils-chat.ts      # Chat-specific utilities
│   ├── utils-message.ts   # Message processing utilities
│   ├── utils-format.ts    # Formatting utilities
│   ├── utils-markdown.ts  # Markdown rendering utilities
│   ├── session-storage.ts # LocalStorage session persistence
│   └── navigation.tsx     # Navigation configuration
├── store/
│   └── use-app-store.ts   # Zustand store (central state management)
└── types/
    ├── chat.ts            # Chat-related types
    ├── gateway.ts         # Gateway protocol types
    └── storage.ts         # Storage-related types
```

## State Management

The app uses a single Zustand store (`use-app-store.ts`) with three main state domains:

### Connection State
- Gateway URL, token, UID
- Connection status (connected, connecting)
- GatewayClient instance
- Hello response with gateway info

### Chat State
- Current session key
- Messages array (ChatMessage[])
- Streaming state (stream content, runId, timestamps)
- Message queue for sequential sending
- Draft message and attachments
- UI preferences (showThinking, focusMode)

### Sessions State
- Sessions list from gateway
- Model info (provider, model name, context tokens)
- Assistant metadata (name, avatar)
- Presence entries and event log

### Persistence

Zustand persist middleware saves to `localStorage` key `openclaw-app-storage`:
- gatewayUrl, token, uid
- sessionKey
- showThinking, focusMode
- assistantName

Chat messages are saved separately via `SessionStorage` utility.

## Gateway Client

`GatewayClient` (in `lib/utils-gateway.ts`) manages WebSocket communication:

### Features
- Auto-reconnect with exponential backoff (800ms base)
- Heartbeat mechanism (20s interval) to prevent connection drops
- Request/response correlation with pending promises
- Two protocols: Gateway RPC and Webhook simple messages
- Event-based callbacks (onHello, onEvent, onClose)

### Gateway Mode Protocol
1. Sends `connect` request with token, protocol v3, operator scopes
2. Receives `hello` response with gateway info
3. Sends `agent` requests for chat messages
4. Receives streaming events: `chat`, `agent.delta`, `agent.final`, `agent.abort`, `gateway.response`

### Bridge Mode Protocol
1. Connects to webhook URL with `?uid=` query parameter
2. Sends simple JSON messages: `{id, content, sender_id, session, ...}`
3. Receives streaming responses: `{type: "progress"|"complete"|"error", content, session}`

## Session Management

Sessions are managed both locally (localStorage) and remotely (gateway):

### Local Storage (`session-storage.ts`)
- Stores session metadata and messages in localStorage
- Key format: `openclaw-session-{sessionKey}`
- Auto-creates sessions with timestamp-based keys
- Limits to 50 most recent sessions

### Remote Sessions
- `sessions.list` RPC call fetches active sessions (last 24 hours)
- `sessions.patch` updates session metadata (label, thinkingLevel, etc.)
- `sessions.delete` removes session and transcript

### Session Switching
When switching sessions:
1. Save current session to localStorage
2. Load target session from localStorage
3. Update sessionKey in store
4. Messages array is replaced with loaded messages

## TypeScript Configuration

- **Target**: ES2024 for modern JavaScript features
- **Module**: ESNext with bundler resolution
- **JSX**: react-jsx (automatic React import)
- **Strict mode**: Enabled
- **Path alias**: `@/*` maps to `./src/*`
- **Types**: Includes `cloudflare-env.d.ts` for Cloudflare bindings

## Important Patterns

### Message Handling

Messages from the gateway are processed differently based on event type:

1. **Chat events** (`event: "chat"`): New protocol with `state: "delta"|"final"|"error"`
2. **Agent events** (`event: "agent.delta"|"agent.final"`): Legacy/bridge protocol
3. **Gateway responses** (`event: "gateway.response"`): RPC responses

The store filters out:
- System messages (role === "system")
- Messages with empty content
- Thinking/meta tags (via `stripThinkingTags`)

### Streaming Display

Streaming responses update the UI in real-time:
1. `stream` state holds partial content
2. `streamStartedAt` tracks when streaming began
3. `StreamingMessage` component displays live content
4. On final event, content moves to `messages` array and `stream` is cleared

### Message Queue

When a message is sent while another is in progress:
1. Message is added to `queue` array
2. When current response completes, `processQueue()` is called
3. Next message in queue is automatically sent
4. Ensures sequential conversation flow

## Configuration Files

### next.config.ts
Standard Next.js config with OpenNext Cloudflare dev initialization:
```typescript
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}
```

### open-next.config.ts
OpenNext-specific Cloudflare settings. Currently minimal, supports R2 cache (commented out).

### wrangler.jsonc
Cloudflare Worker configuration:
- Worker name: `openclaw-app`
- Compatibility date: 2025-12-01
- Flags: `nodejs_compat`, `global_fetch_strictly_public`
- Asset binding, image optimization, self-reference service

### components.json
Radix UI component configuration (shadcn/ui style).

## Styling

### Tailwind CSS v4
- Uses `@tailwindcss/postcss` plugin
- Animations via `tw-animate-css`
- Global styles in `app/globals.css`

### Radix UI
- Component library for accessible UI primitives
- Components in `components/ui/`
- Styled with Tailwind classes and `class-variance-authority`

## WebSocket Protocol Details

### Gateway RPC Format
```json
{
  "type": "req",
  "id": "unique-id",
  "method": "agent",
  "params": { "message": "...", "agentId": "main", "sessionKey": "...", ... }
}
```

Response:
```json
{
  "type": "res",
  "id": "unique-id",
  "ok": true,
  "payload": { ... }
}
```

### Webhook Simple Format
```json
{
  "id": "run-timestamp",
  "content": "user message",
  "sender_id": "user-uid",
  "session": "session-key",
  "peerKind": "dm",
  "peerId": "user-uid",
  "chatType": "dm",
  "chatId": "user-uid",
  "senderId": "user-uid"
}
```

Response (streaming):
```json
// Progress
{ "type": "progress", "content": "partial...", "session": "..." }

// Complete
{ "type": "complete", "content": "full response", "session": "..." }

// Error
{ "type": "error", "content": "error message", "session": "..." }
```

## Key Conventions

- **Package Manager**: Use `pnpm` (not npm) - required for Tailwind CSS patch scripts
- **Path Imports**: Use `@/` alias for all src imports
- **State Updates**: Use Zustand actions, never mutate state directly
- **Type Safety**: All gateway types defined in `types/gateway.ts`
- **Error Handling**: Store `lastError` in Zustand for user display
- **Session Keys**: Default is `"main"`, auto-generated for new sessions
- **Message Timestamps**: Use `Date.now()` for local timestamps

## Development Workflow

1. Start development server: `pnpm dev`
2. Open http://localhost:3000
3. Configure gateway URL and token in settings
4. Connect and start chatting

For Cloudflare-specific testing:
1. Build for Cloudflare: `pnpm build`
2. Preview locally: `pnpm preview`
3. Deploy when ready: `pnpm deploy`

## Deployment

The app deploys to Cloudflare Workers via OpenNext:

1. Build creates `.open-next/` directory with:
   - Assets (static files)
   - Worker bundle (`_worker.js`)

2. Wrangler deploys to Cloudflare edge network

3. Access via `https://openclaw-app.<your-subdomain>.workers.dev`

## Related Documentation

- Parent project README: `../CLAUDE.md` (overall system architecture)
- OpenNext Cloudflare docs: https://opennext.js.org/cloudflare
- Gateway protocol: See `../COMMANDS.md` and `../SESSION_CONTROL.md` (Chinese)
