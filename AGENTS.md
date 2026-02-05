# Repository Guidelines for Agentic AI

This document provides essential information for AI agents working on the **OpenClaw Webhook Bridge** project (`moltbotCNAPP`). Adhere strictly to these patterns to ensure consistency and safety.

## 1. Project Structure & Organization

The project is a multi-component system connecting webhooks to OpenClaw AI Gateway:

- `cmd/bridge/`: Main Go entrypoint for the OpenClaw Bridge daemon
- `internal/`: Core Go packages (bridge, openclaw, webhook, config, sessions)
- `cloudflare-webhook/`: Cloudflare Workers webhook service (TypeScript, Hono, Durable Objects)
- `node-webhook/`: Local Node.js WebSocket server for testing (ES modules)
- `openclaw-mapp/`: WeChat Mini Program frontend (Taro, React, Tailwind CSS)
- `scripts/`: Build utilities and cross-platform packaging scripts
- `dist/`: Build artifacts (not committed)

**Key Architecture**: Bridge connects WebSocket webhooks to OpenClaw Gateway (localhost:18789) with UID-based routing.

## 2. Build, Development, and Linting Commands

### Go Bridge Commands (via Makefile)
- **Build**: `make build` - Compile for current platform → `openclaw-bridge`
- **Build all platforms**: `make build-all` - Cross-compile via `./scripts/build.sh`
- **Build release** (no logs): `make build-release` - Use `-tags release`
- **Dev mode**: `make dev` - Run with `go run ./cmd/bridge/` (no compilation)
- **Run**: `make run` - Build then execute binary
- **Format**: `make fmt` - Run `gofmt` on all Go files
- **Static analysis**: `make vet` - Run `go vet ./...`
- **Lint**: `make lint` - Run both `fmt` and `vet`
- **Test**: `make test` - Run `go test -v ./...`
- **Clean**: `make clean` - Remove binaries and build artifacts
- **Tidy**: `make tidy` - Sync dependencies with `go mod tidy`
- **Install**: `make install` - Install to `$GOPATH/bin`

### Testing Commands
- **All tests**: `go test -v ./...` or `make test`
- **Single package**: `go test -v ./internal/webhook/`
- **Specific test**: `go test -v -run TestConnectionLoop ./internal/webhook/`
- **With coverage**: `go test -cover ./...`

**Note**: No test files exist yet - tests should be created in `*_test.go` files alongside source.

### Cloudflare Workers (TypeScript)
```bash
cd cloudflare-webhook
pnpm dev           # Local Wrangler dev server
pnpm deploy        # Deploy to Cloudflare
pnpm tail          # Real-time logs
pnpm test          # Run Vitest tests
npx tsc --noEmit   # Type checking only
```

### Node.js Test Server
```bash
cd node-webhook
npm install
npm start          # Starts on localhost:8787
```

### WeChat Mini Program (Taro + React)
```bash
cd openclaw-mapp
pnpm install           # Required: use pnpm, NOT npm
pnpm dev:weapp         # Watch mode for WeChat DevTools
pnpm build:weapp       # Production build
pnpm typescript        # Type check (tsc --noEmit)
```

**IMPORTANT**: `openclaw-mapp` MUST use `pnpm` due to `weapp-tailwindcss` patch scripts in `postinstall`.

## 3. Code Style & Conventions

### Go Style (Go 1.21+)
- **Formatting**: ALWAYS use `gofmt` (tabs, not spaces)
- **Imports**: Three groups separated by blank lines:
  ```go
  import (
      // 1. Standard library
      "context"
      "fmt"
      "log"

      // 2. Third-party
      "github.com/gorilla/websocket"

      // 3. Internal
      "github.com/sternelee/openclaw-webhook-bridge/internal/config"
  )
  ```
- **Naming**:
  - Packages: lowercase, single-word (`webhook`, `openclaw`, `bridge`)
  - Exported: PascalCase (`Client`, `MessageHandler`)
  - Unexported: camelCase (`connectionLoop`, `connMu`)
  - Interfaces: Often `-er` suffix (`MessageHandler`, `ResponseHandler`)
  - Acronyms: Consistent case (`URL` not `Url`, `ID` not `Id`)
- **Types**:
  - Use `atomic.Bool` for thread-safe flags
  - Use `sync.RWMutex` for shared state (e.g., `connMu sync.RWMutex`)
  - Always pass `context.Context` as first parameter in long-running funcs
- **Comments**: Exported symbols MUST have doc comments starting with name
  ```go
  // Client is a WebSocket webhook client
  type Client struct { ... }
  ```

### TypeScript Style (Cloudflare Workers)
- **Strict mode**: `"strict": true` in `tsconfig.json`
- **Module**: ES2022 with `moduleResolution: "bundler"`
- **Types**: Use Cloudflare Workers types (`@cloudflare/workers-types`)
- **Environment**: Export `interface Env` for Durable Object bindings
  ```typescript
  export interface Env {
    WEBSOCKET_HUB: DurableObjectNamespace;
  }
  ```
- **Hono**: Type-safe routing with `Hono<{ Bindings: Env; Variables: Variables }>()`
- **Formatting**: 2 spaces, semicolons, single quotes preferred

### TypeScript/React Style (Mini Program)
- **Target**: ES2017 (WeChat compatibility)
- **JSX**: `"jsx": "react-jsx"` (React 18)
- **Strict**: `"strict": false` (legacy Taro compatibility)
- **Decorators**: Enabled (`experimentalDecorators: true` for MobX)
- **Paths**: Use `@/` alias for `./src/*`
- **Formatting**: 2 spaces, match existing Taro patterns

### Node.js Style (Test Server)
- **ES Modules**: Use `import/export` (`"type": "module"` in package.json)
- **Async**: Prefer `async/await` over callbacks
- **Indentation**: 2 spaces

## 4. Error Handling & Logging

### Go Error Handling
- **Always check errors immediately**:
  ```go
  if err := conn.ReadMessage(); err != nil {
      return fmt.Errorf("read error: %w", err)
  }
  ```
- **Wrap errors** with `%w` for error chain inspection (`errors.Is`, `errors.As`)
- **NEVER panic** in production code - return errors gracefully
- **Sentinel errors**: Define package-level `var Err... = errors.New(...)`

### Logging Pattern
- **Component prefixes** in square brackets:
  ```go
  log.Printf("[Webhook] Connected to %s (UID: %s)", url, uid)
  log.Printf("[OpenClaw] Connection error: %v", err)
  log.Printf("[Bridge] Forwarding message to session: %s", session)
  ```
- **Privacy**: NEVER log message content (may contain sensitive data)
  ```go
  // ✅ Good: Don't log message content for privacy
  log.Printf("[Webhook] Received message")
  
  // ❌ Bad: Exposes user data
  log.Printf("[Webhook] Message: %s", string(message))
  ```
- **Verbosity**: Minimal logging in hot paths (message forwarding loops)

## 5. Configuration & Security

- **Config files**: `~/.openclaw/openclaw.json` (gateway), `~/.openclaw/bridge.json` (bridge)
- **Secrets**: NEVER commit tokens, API keys, or credentials
  - Use env vars or local config files
  - Bridge config includes UID, webhook URL, agent ID
- **Validation**: Sanitize ALL external input (webhook messages, query params)
- **UID requirement**: WebSocket connections MUST include `?uid=xxx` for routing

## 6. Concurrency & WebSocket Patterns

### Go Concurrency (Critical)
- **Context propagation**: Always pass `context.Context` to goroutines
  ```go
  func (c *Client) Connect(ctx context.Context) error {
      c.ctx, c.cancel = context.WithCancel(ctx)
      c.wg.Add(1)
      go c.connectionLoop() // Must respect c.ctx.Done()
      // ...
  }
  ```
- **Mutex locking**: RLock for reads, Lock for writes
  ```go
  c.connMu.RLock()
  conn := c.conn
  c.connMu.RUnlock()
  ```
- **Atomic flags**: Use `atomic.Bool` for `connected` state
- **WaitGroup**: Track goroutines for graceful shutdown

### WebSocket Reconnection
- **Exponential backoff**: 2s → 4s → 8s → max 30s delay
- **Auto-reconnect**: Loop until context cancelled
- **Connection loop pattern**: See `internal/webhook/client.go` and `internal/openclaw/client.go`

## 7. Testing Strategy

### Go Testing (to be implemented)
- **File naming**: `*_test.go` in same package
- **Table-driven tests** for complex logic:
  ```go
  func TestParseMessage(t *testing.T) {
      tests := []struct {
          name    string
          input   []byte
          want    Message
          wantErr bool
      }{
          // test cases...
      }
      for _, tt := range tests {
          t.Run(tt.name, func(t *testing.T) { ... })
      }
  }
  ```
- **Standard library**: Prefer `testing` package over frameworks
- **Mocking**: Use interfaces (`MessageHandler`, `EventCallback`)

### Integration Testing
- Use `node-webhook/server.js` + `test-page.html` to simulate end-to-end flow
- Test UID routing with multiple bridge instances
- Verify session isolation between different UIDs

## 8. Git & PR Guidelines

- **Commit messages**: Short, imperative (e.g., "Add session list command", "Fix reconnection backoff")
- **Atomic commits**: One logical change per commit
- **PR checklist**:
  - Run `make lint` and `make test` (Go)
  - Run `pnpm typescript` (for TS changes)
  - Describe what was changed and why
  - List test commands used for verification

## 9. Development Environment

- **Workspace**: `/Users/sternelee/www/github/moltbotCNAPP`
- **Platform**: Primarily macOS (darwin), but cross-platform builds supported
- **Dependencies**:
  - Go: Check `go.mod` (gorilla/websocket, google/uuid, skip2/go-qrcode)
  - Cloudflare: Check `cloudflare-webhook/package.json` (hono, wrangler)
  - Node: Check `node-webhook/package.json` (ws)
  - Mini Program: Check `openclaw-mapp/package.json` (@tarojs/*, tailwindcss, weapp-tailwindcss)

## 10. AI Agent Instructions

### Proactive Actions
- Run `make lint` after any Go code changes
- Run `make test` after implementing features (create tests if missing)
- Run `pnpm typescript` after TypeScript changes
- Check for compilation errors before committing

### Self-Correction
- If build fails, analyze output and fix immediately
- If linting fails, apply `gofmt` and address `go vet` warnings
- Don't wait for user prompts to fix obvious issues

### Best Practices
- Prefer editing existing files over creating new ones
- Follow existing patterns in codebase (e.g., connection loop, error wrapping)
- Maintain privacy: don't log message contents
- Test locally with `node-webhook` before deploying to Cloudflare
- Use descriptive variable names matching existing style (`msg`, `ctx`, `conn`, `connMu`)

### Special Notes
- **No Cursor/Copilot rules found** - follow this document as the source of truth
- **UID routing** is critical - ensure all WebSocket URLs include `?uid=xxx`
- **Session isolation** - each session key should maintain independent context
- **Tailwind in Mini Program** - uses `weapp-tailwindcss` plugin with specific build pipeline
