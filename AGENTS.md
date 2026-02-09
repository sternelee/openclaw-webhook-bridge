# Repository Guidelines for Agentic AI

**OpenClaw Webhook Bridge** - Multi-component system connecting webhooks to OpenClaw AI Gateway via UID-based routing.

## Project Structure

- `src/`, `Cargo.toml` - Rust bridge implementation (primary)
- `cmd/bridge/`, `internal/` - Go bridge implementation (legacy)
- `cloudflare-webhook/` - Cloudflare Workers service (TypeScript, Hono)
- `node-webhook/` - Local Node.js WebSocket test server
- `openclaw-mapp/` - WeChat Mini Program (Taro, React, Tailwind)
- `openclaw-app/` - Tauri desktop application

## Build & Test Commands

### Rust (Primary)
```bash
make -f Makefile.rust build           # Debug build
make -f Makefile.rust build-release   # Release build
cargo test                            # Run all tests
cargo test -- --test-threads=1        # Single test by name: cargo test test_name
cargo test -- --test-threads=1 bridge::tests::test_bridge_forward  # Specific test
make -f Makefile.rust fmt             # Format with rustfmt
make -f Makefile.rust clippy          # Lint with clippy
make -f Makefile.rust run             # Run in foreground
cargo check                           # Fast syntax/type check
```

### Go (Legacy)
```bash
make build              # Build openclaw-bridge binary
make dev                # Run with go run (no compile)
make test               # Run all tests: go test -v ./...
go test -v ./internal/webhook/                    # Single package
go test -v -run TestConnectionLoop ./internal/webhook/  # Specific test
go test -cover ./...    # With coverage
make fmt                # gofmt
make vet                # go vet
make lint               # fmt + vet
make tidy               # go mod tidy
```

### Cloudflare Workers
```bash
cd cloudflare-webhook
pnpm dev                # Local Wrangler dev server
pnpm deploy             # Deploy to Cloudflare
pnpm test               # Run Vitest tests
npx tsc --noEmit        # Type check
```

### WeChat Mini Program
```bash
cd openclaw-mapp
pnpm install            # REQUIRED: use pnpm, NOT npm
pnpm dev:weapp          # Watch mode for WeChat DevTools
pnpm build:weapp        # Production build
pnpm typescript         # Type check
```

### Node.js Test Server
```bash
cd node-webhook
npm install && npm start    # Starts on localhost:8787
```

## Code Style

### Rust
- **Formatting**: `rustfmt` (4 spaces, standard Rust style)
- **Imports**: Group by std, external crates, internal modules
- **Naming**: snake_case (functions/vars), PascalCase (types/structs), SCREAMING_SNAKE_CASE (consts)
- **Error handling**: Use `anyhow::Result` for app, `thiserror` for libraries, propagate with `?`
- **Async**: `tokio` runtime, use `async/await`, propagate cancellation via `tokio::select!`
- **Logging**: `log` crate with `env_logger`, component prefixes: `[Bridge]`, `[Webhook]`

### Go
- **Formatting**: `gofmt` (tabs, not spaces) - NEVER skip this
- **Imports**: Three groups (std lib, third-party, internal) separated by blank lines
- **Naming**: PascalCase (exported), camelCase (unexported), consistent acronyms (`URL`, `ID`)
- **Error handling**: Check errors immediately, wrap with `%w` for `errors.Is/As`, NEVER panic
- **Types**: `atomic.Bool` for flags, `sync.RWMutex` for shared state, pass `context.Context` first
- **Comments**: Exported symbols MUST have doc comments starting with name

### TypeScript (Cloudflare Workers)
- Strict mode enabled, ES2022, 2 spaces, semicolons
- Export `interface Env` for Durable Object bindings
- Type-safe Hono routing: `Hono<{ Bindings: Env }>()`

### TypeScript/React (Mini Program)
- Target ES2017 (WeChat compatibility), `jsx: react-jsx`
- `strict: false` (legacy Taro compatibility)
- Use `@/` alias for `./src/*`

## Error Handling & Logging

```rust
// Rust - Propagate errors with ?
let result = some_operation().context("failed to do thing")?;

// Go - Check immediately, wrap errors
if err := conn.ReadMessage(); err != nil {
    return fmt.Errorf("read error: %w", err)
}
```

**Logging Rules**:
- Use component prefixes: `[Bridge]`, `[Webhook]`, `[OpenClaw]`, `[Session]`
- NEVER log message content (privacy) - log receipt only
- Minimal logging in hot paths

## Testing

**Rust**: `cargo test -- --test-threads=1 test_name_pattern`
**Go**: `go test -v -run TestName ./package/`

Create tests in `#[cfg(test)]` modules (Rust) or `*_test.go` files (Go).

## Key Conventions

1. **UID Routing**: All WebSocket connections MUST include `?uid=xxx` query param
2. **Session Isolation**: Each session key maintains independent context
3. **Secrets**: NEVER commit tokens/API keys - use env vars or config files (`~/.openclaw/`)
4. **Concurrency**: Use `tokio::sync` (Rust) or `sync.RWMutex` (Go) for shared state
5. **WebSocket Reconnect**: Exponential backoff 2s→4s→8s→max 30s

## Agent Actions

- Run `cargo clippy` / `make -f Makefile.rust fmt` after Rust changes
- Run `make lint` after Go changes  
- Run `pnpm typescript` after TypeScript changes
- Check compilation before committing
- Follow existing patterns - don't introduce new conventions
- Prefer editing existing files over creating new ones
- Don't log sensitive message content
