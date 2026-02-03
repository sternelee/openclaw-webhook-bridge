# Repository Guidelines

## Project Structure & Module Organization
- `cmd/bridge/` holds the main entrypoint for the OpenClaw Bridge binary.
- `internal/` contains core services: bridge orchestration, OpenClaw client, config loading, and webhook handling.
- `scripts/` includes build helpers such as cross-platform packaging.
- `src/` and `local-webhook-server/` host web UI/support tooling (pages, services, stores, types).
- `openclaw-bridge/`, `openclaw-mapp/`, and `workers/` include auxiliary apps or integration code; keep changes scoped to the component you’re updating.

## Build, Test, and Development Commands
- `make build` — compile the bridge for the current platform into `clawdbot-bridge`.
- `make dev` — run the bridge in dev mode with `go run ./cmd/bridge/`.
- `make build-all` — build all platform targets via `./scripts/build.sh`.
- `make run` — build then run the binary locally.
- `make fmt` / `make vet` / `make lint` — format and run Go static checks.
- `make tidy` — run `go mod tidy` after dependency changes.

## Coding Style & Naming Conventions
- Go code is formatted with `gofmt` (tabs, standard Go layout). Run `make fmt` before committing.
- Keep package names short and lowercase (e.g., `bridge`, `config`), and prefer file names that match the package purpose.
- For new config keys, mirror existing JSON naming patterns and document defaults in README or inline help.

## Testing Guidelines
- There are currently no committed Go tests. When adding tests, place them next to code in `*_test.go` files.
- Use table-driven tests where possible and run `go test ./...` (or `make test`) locally before opening a PR.

## Commit & Pull Request Guidelines
- Recent commits use short, imperative summaries (e.g., “Add UID-based routing”). Keep messages concise and unprefixed.
- PRs should include: a brief summary, testing notes (commands run), and links to related issues.
- If you touch the web UI (`src/` or `local-webhook-server/`), include screenshots or a quick GIF.

## Configuration & Security Notes
- Runtime config lives in `~/.openclaw/openclaw.json` and `~/.openclaw/bridge.json`; avoid committing secrets.
- WebSocket credentials and tokens should be injected via local config or environment variables, never hardcoded.
