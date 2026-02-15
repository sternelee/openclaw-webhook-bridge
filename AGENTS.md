# Repository Guidelines for Agentic AI

**OpenClaw Webhook Bridge** - Multi-component system connecting webhooks to OpenClaw AI Gateway via UID-based routing.

## Project Structure

- `src/`, `Cargo.toml` - Rust bridge implementation (primary)
- `cloudflare-webhook/` - Cloudflare Workers service (TypeScript, Hono)
- `node-webhook/` - Local Node.js WebSocket test server
- `openclaw-mapp/` - WeChat Mini Program (Taro, React, Tailwind)
- `openclaw-app/` - Next.js web application (OpenNext for Cloudflare)

## Build & Test Commands

### Rust (Primary)
```bash
make build           # Debug build
make build-release   # Release build
cargo test                            # Run all tests
cargo test test_session_key           # Single test by name
cargo test -- --nocapture             # Show test output
make fmt             # Format with rustfmt
make clippy          # Lint with clippy
make lint            # fmt + clippy
make run             # Run in foreground
cargo check          # Fast syntax/type check
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

### TypeScript (Cloudflare Workers)
- Strict mode enabled, ES2022, 2 spaces, semicolons
- Export `interface Env` for Durable Object bindings
- Type-safe Hono routing: `Hono<{ Bindings: Env }>()`

### TypeScript/React (Mini Program)
- Target ES2017 (WeChat compatibility), `jsx: react-jsx`
- `strict: false` (legacy Taro compatibility)
- Use `@/` alias for `./src/*`

### TypeScript/React (openclaw-app)
- Next.js 16 with React 19, App Router
- Zustand for state management (`use-app-store.ts`)
- Tailwind CSS v4 with Radix UI components
- Deployed via OpenNext for Cloudflare Workers

## Error Handling & Logging

```rust
// Rust - Propagate errors with ?
let result = some_operation().context("failed to do thing")?;
```

**Logging Rules**:
- Use component prefixes: `[Bridge]`, `[Webhook]`, `[OpenClaw]`, `[Session]`
- NEVER log message content (privacy) - log receipt only
- Minimal logging in hot paths

## Testing

**Rust**: `cargo test -- --test-threads=1 test_name_pattern`

Create tests in `#[cfg(test)]` modules (Rust).

## Key Conventions

1. **UID Routing**: All WebSocket connections MUST include `?uid=xxx` query param
2. **Session Isolation**: Each session key maintains independent context
3. **Secrets**: NEVER commit tokens/API keys - use env vars or config files (`~/.openclaw/`)
4. **Concurrency**: Use `tokio::sync` (Rust) for shared state
5. **WebSocket Reconnect**: Exponential backoff 2s→4s→8s→max 30s

## Agent Actions

- Run `cargo clippy` / `make fmt` after Rust changes
- Run `pnpm typescript` after TypeScript changes
- Check compilation before committing
- Follow existing patterns - don't introduce new conventions
- Prefer editing existing files over creating new ones
- Don't log sensitive message content
