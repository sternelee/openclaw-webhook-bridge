# Message Events Documentation

This document describes the message event system for connection and configuration handling in the OpenClaw Webhook Bridge.

## Overview

The system now supports special message types for connection lifecycle and configuration synchronization:

- **`system.connected`**: Sent by clients when WebSocket connection is established
- **`system.ready`**: Sent by server when it's ready to receive messages
- **`config.update`**: Sent by clients when configuration settings change

## Message Formats

### System Connected Message

Sent by the client immediately after WebSocket connection is established.

```json
{
  "type": "system.connected",
  "clientInfo": {
    "platform": "wechat-miniprogram" | "web" | "mobile",
    "mode": "webchat" | "bridge",
    "timestamp": 1707625200000,
    "uid": "unique-client-id"
  }
}
```

**Purpose**: Notifies the server that a client has connected and is ready to receive messages.

**When sent**:
- Mini-program: After `Taro.onSocketOpen` fires
- Web app: After Gateway `connect` or in webhook mode after connection
- Delay: 100ms after connection to ensure stability

### System Ready Message

Sent by the server to newly connected clients.

```json
{
  "type": "system.ready",
  "timestamp": 1707625200100,
  "serverInfo": {
    "platform": "cloudflare-workers" | "node" | "rust-bridge",
    "uid": "connection-uid"
  }
}
```

**Purpose**: Notifies the client that the server is ready to process requests.

**When sent**:
- Cloudflare webhook: After accepting WebSocket connection
- Delay: 100ms after connection to ensure stability

**Client handling**:
- Mini-program: Sets `serverReady = true`, triggers pending session list requests
- Web app: Can trigger initial data loading

### Config Update Message

Sent by clients when configuration settings change.

```json
{
  "type": "config.update",
  "timestamp": 1707625200200,
  "config": {
    "field": "sessionId" | "uid" | "wsUrl" | "peerKind" | "peerId" | "topicId" | "threadId",
    "value": "new-value"
  }
}
```

**Purpose**: Notifies other clients (with same UID) when configuration changes.

**When sent**:
- Mini-program: When `setWsUrl()`, `setSessionId()`, `setUid()`, etc. are called
- Web app: When configuration is updated (future implementation)
- Only sent if `connected === true`

**Use cases**:
- Multi-device synchronization
- Debugging/logging configuration changes
- Triggering reconfiguration on other clients

## Implementation Details

### Mini-Program (WeChat)

**File**: `openclaw-mapp/src/services/websocket.ts`

```typescript
// Send connection message after WebSocket opens
private sendConnectionMessage(): void {
  const message = {
    type: "system.connected",
    clientInfo: { /* ... */ }
  };
  setTimeout(() => {
    this.send(message).catch(console.error);
  }, 100);
}
```

**File**: `openclaw-mapp/src/store/chatStore.ts`

```typescript
// Send config update on settings change
private sendConfigUpdateMessage(field: string, value: any) {
  if (!this.connected) return;
  const message = {
    type: "config.update",
    timestamp: Date.now(),
    config: { field, value }
  };
  this.wsService.send(message).catch(console.error);
}

// Handle system.ready message
if (data.type === "system.ready") {
  this.serverReady = true;
  if (this.pendingSessionListRequest) {
    this.doSessionListRequest();
  }
}
```

### Web App

**File**: `openclaw-app/src/lib/utils-gateway.ts`

```typescript
// Send connection message after Gateway connect
private sendConnectionMessage(): void {
  const message = {
    type: "system.connected",
    clientInfo: { /* ... */ }
  };
  setTimeout(() => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }, 100);
}
```

Called in two places:
1. After successful Gateway `hello` response
2. In webhook mode after connection established

### Cloudflare Webhook

**File**: `cloudflare-webhook/src/websocket-hub.ts`

```typescript
// Send welcome message to new connections
private sendWelcomeMessage(ws: WebSocket, uid: string): void {
  const message = {
    type: "system.ready",
    timestamp: Date.now(),
    serverInfo: { platform: "cloudflare-workers", uid }
  };
  setTimeout(() => {
    ws.send(JSON.stringify(message));
  }, 100);
}

// Log connection and config messages
webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
  const parsed = JSON.parse(data as string);
  if (parsed?.type === "system.connected" || parsed?.type === "config.update") {
    console.log(`[WebSocketHub] ${parsed.type} from UID=${uid}`);
  }
  // ... broadcast to other clients with same UID
}
```

## Message Flow Diagram

```
┌─────────────┐                  ┌──────────────────┐                  ┌─────────────┐
│   Client    │                  │ Cloudflare       │                  │   Client    │
│  (Mini-app) │                  │ Webhook Hub      │                  │  (Web app)  │
└──────┬──────┘                  └────────┬─────────┘                  └──────┬──────┘
       │                                   │                                   │
       │ 1. WebSocket OPEN                 │                                   │
       ├──────────────────────────────────>│                                   │
       │                                   │                                   │
       │ 2. system.connected               │                                   │
       │    (100ms delay)                  │                                   │
       ├──────────────────────────────────>│                                   │
       │                                   │                                   │
       │ 3. system.ready                   │                                   │
       │<──────────────────────────────────┤                                   │
       │    (100ms delay)                  │                                   │
       │                                   │                                   │
       │ 4. config.update (setSessionId)   │                                   │
       ├──────────────────────────────────>│                                   │
       │                                   │  5. config.update (broadcast)     │
       │                                   ├──────────────────────────────────>│
       │                                   │                                   │
       │ 6. Regular messages...            │                                   │
       ├──────────────────────────────────>│                                   │
       │                                   │                                   │
```

## Testing

To test the message events:

1. **Connection Messages**:
   ```bash
   # Start cloudflare webhook
   cd cloudflare-webhook && npm run dev
   
   # Connect with test client
   wscat -c "ws://localhost:8787/ws?uid=test-123"
   
   # Should receive system.ready message
   ```

2. **Config Updates**:
   ```bash
   # In mini-program or web app, change a setting
   # Check browser/mini-program console for "Config update received"
   ```

3. **Multi-Client Sync**:
   ```bash
   # Open two clients with same UID
   # Change config in one client
   # Verify the other client receives config.update
   ```

## Future Enhancements

1. **Acknowledged Messages**: Add request/response pattern for config updates
2. **Config Sync**: Implement full config synchronization on connect
3. **Heartbeat**: Add periodic ping/pong for connection health
4. **Reconnection**: Send reconnection info in system.connected
5. **Version Check**: Include protocol version in messages

## Related Files

- `openclaw-mapp/src/services/websocket.ts` - Mini-program WebSocket service
- `openclaw-mapp/src/store/chatStore.ts` - Mini-program chat store with config handling
- `openclaw-app/src/lib/utils-gateway.ts` - Web app Gateway client
- `openclaw-app/src/store/use-app-store.ts` - Web app state management
- `cloudflare-webhook/src/websocket-hub.ts` - Cloudflare Durable Object WebSocket hub
- `SESSION_CONTROL.md` - Session control message documentation

## Protocol Compatibility

These system messages are designed to coexist with existing message types:

- **Gateway protocol**: `type: "req"`, `type: "res"`, `type: "event"`
- **Session control**: `type: "session.list"`, `type: "session.get"`, etc.
- **Bridge format**: `type: "progress"`, `type: "complete"`, `type: "error"`

System messages use the `system.*` and `config.*` namespaces to avoid conflicts.
