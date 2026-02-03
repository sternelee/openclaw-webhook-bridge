# OpenClaw Bridge (Bun + TypeScript)

This module mirrors the Go bridge: it forwards WebSocket webhook messages to the local OpenClaw Gateway and streams responses back to the webhook server.

## Requirements

- Bun >= 1.1
- `~/.openclaw/openclaw.json` with gateway port/token
- `~/.openclaw/bridge.json` with `webhook_url`

## Install

```bash
cd ts-bridge
bun install
```

## Run

```bash
bun run src/cli.ts start webhook_url=ws://localhost:8080/ws
```

The CLI runs in the foreground. Stop with Ctrl+C.

## Behavior Parity

- Filters webhook control messages with `type` in `connected`, `error`, `event`.
- Uses `session` if provided, else `webhook:{id}` for OpenClaw sessions.
- Appends `uid` as a query param when connecting to the webhook server.

## Project Layout

- `src/bridge.ts` core bridge logic
- `src/openclaw/` OpenClaw Gateway client
- `src/webhook/` webhook client
- `src/config.ts` config loader and CLI config writer
