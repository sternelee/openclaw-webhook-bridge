# Repository Guidelines for Agentic AI

This document provides essential information for AI agents working on the `openclaw-webhook-bridge` project. Adhere strictly to these patterns to ensure consistency and safety.

## 1. Project Structure & Organization

The project is a hybrid Go and Node.js/TypeScript codebase, primarily serving as a bridge between webhooks and the OpenClaw Gateway.

- `cmd/bridge/`: Main entrypoint for the OpenClaw Bridge (Go).
- `internal/`: Core Go packages (orchestration, clients, sessions, config, webhooks).
- `cloudflare-webhook/`: Cloudflare Workers webhook service with Hono and Durable Objects.
- `node-webhook/`: Node.js-based WebSocket server for local testing.
- `scripts/`: Build and utility scripts (e.g., cross-platform packaging).
- `dist/`: Build artifacts (not committed).

## 2. Build, Development, and Linting

Use the provided `Makefile` for Go-related tasks and `npm` for Node.js tasks.

### Go Commands
- `make build`: Compile the bridge for the current platform into `openclaw-bridge`.
- `make dev`: Run the bridge directly with `go run ./cmd/bridge/`.
- `make run`: Build then execute the binary.
- `make clean`: Remove build artifacts and clean Go cache.
- `make tidy`: Run `go mod tidy` to sync dependencies.
- `make fmt`: Format code with `gofmt`.
- `make vet`: Run static analysis with `go vet`.
- `make lint`: Run both `fmt` and `vet`.

### Node.js Commands (in `node-webhook/`)
- `npm start`: Start the local webhook test server.
- `npm install`: Install dependencies (primarily `ws`).

### TypeScript Commands (in `cloudflare-webhook/`)
- `pnpm dev`: Run Wrangler dev server.
- `pnpm deploy`: Deploy to Cloudflare Workers.
- `pnpm tail`: Tail real-time logs.
- `tsc --noEmit`: Type check without emitting files.

## 3. Testing Guidelines

### Go Testing
- **Run all tests**: `go test -v ./...` or `make test`.
- **Run a single package**: `go test -v ./internal/sessions/`.
- **Run a specific test**: `go test -v -run TestName ./path/to/pkg`.
- **Conventions**:
    - Place tests in `*_test.go` files in the same directory as the code.
    - Use table-driven tests for complex logic.
    - Prefer standard library `testing` package; avoid adding heavy test frameworks unless necessary.

### Integration Testing
- Use `node-webhook/server.js` and `test-page.html` to simulate webhook events and verify end-to-end flow.
- Use `cloudflare-webhook` with Wrangler dev for Cloudflare Durable Objects testing.

## 4. Coding Style & Conventions

### Go Style
- **Formatting**: Always use `gofmt` (tabs for indentation).
- **Imports**: Group imports into three blocks separated by newlines:
    1. Standard library.
    2. Third-party packages.
    3. Internal project packages.
- **Naming**:
    - Packages: Short, lowercase, single-word (e.g., `config`, `sessions`).
    - Interfaces: Usually end in `-er` (e.g., `WebhookClient`).
    - Exported names: PascalCase; unexported: camelCase.
    - Variables: Short but descriptive (e.g., `msg` for message, `ctx` for context).
- **Concurrency**:
    - Use `sync.RWMutex` for shared state protection.
    - Use `atomic` package for simple flags/counters.
    - Ensure `context.Context` is passed down to long-running operations.

### Node.js Style (Node Webhook Server)
- **ES Modules**: Use `import/export` (defined in `package.json` as `"type": "module"`).
- **Indentation**: 2 spaces (as per existing `server.js`).
- **Async**: Prefer `async/await` over raw promises or callbacks.

### TypeScript Style (Cloudflare Workers)
- **Framework**: Hono for HTTP routing with proper TypeScript types.
- **Durable Objects**: Use Cloudflare's `DurableObjectState` for WebSocket hibernation.
- **Type Safety**: Export environment types (`interface Env`) for Durable Object bindings.

## 5. Error Handling & Logging

### Go Error Handling
- **Pattern**: Check errors immediately and return or log them.
    ```go
    if err := json.Unmarshal(data, &msg); err != nil {
        return fmt.Errorf("failed to parse message: %w", err)
    }
    ```
- **Wrapping**: Use `%w` with `fmt.Errorf` to wrap errors for later inspection with `errors.Is` or `errors.As`.
- **Panic**: NEVER use `panic` in library or service code. Handle errors gracefully.

### Logging
- **Standard**: Use the `log` package.
- **Context**: Prefix log messages with the component name in brackets:
    - `log.Printf("[Bridge] Webhook -> OpenClaw: %s", data)`
    - `log.Printf("[OpenClaw] Connection error: %v", err)`
- **Verbosity**: Avoid excessive logging in "hot" paths unless in debug mode.

## 6. Configuration & Security

- **Storage**: Runtime configuration defaults to `~/.openclaw/openclaw.json` and `~/.openclaw/bridge.json`.
- **Secrets**: NEVER hardcode API keys, tokens, or credentials. Use environment variables or local config files.
- **Validation**: Validate all external input (webhooks, gateway messages) before processing.

## 7. Git & Pull Request Guidelines

- **Commit Messages**: Use short, imperative summaries (e.g., "Add session persistence").
- **PR Content**:
    - Provide a brief summary of changes.
    - List the commands run to verify the changes.
    - Include screenshots/GIFs if modifying the web UI (if applicable).
- **Atomic Commits**: Keep commits focused on a single logical change.

## 8. Development Environment Tips

- **Workspace**: The project root is `/Users/sternelee/www/github/openclaw-webhook-bridge`.
- **Dependencies**: Always check `go.mod`, `cloudflare-webhook/package.json`, and `node-webhook/package.json` before assuming a library is available.
- **Platform**: Primarily developed and tested on `darwin` (macOS), but aimed for cross-platform compatibility.

## 9. Rules and AI Instructions

- **Cursor/Copilot**: No specific project-level rules were found in `.cursorrules` or `.github/copilot-instructions.md`. Follow the general guidelines in this document.
- **Proactiveness**: Agents should proactively run `make lint` and `make test` after any significant code change.
- **Self-Correction**: If a build fails, analyze the output and fix immediately without waiting for user prompting.
