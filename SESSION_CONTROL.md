# Session Control Messages

本文档说明如何通过 webhook 发送消息来同步和创建 sessions。

## 概述

OpenClaw Webhook Bridge 支持通过 WebSocket 消息来控制 session 的生命周期。你可以：

1. **同步已有 Session** - 指定使用已有的 session key
2. **自动创建 Session** - 每个新消息自动创建唯一 session
3. **重置 Session** - 清空当前 session 的上下文
4. **查询 Session** - 获取 session 的详细信息
5. **列出所有 Sessions** - 查看所有活跃的 sessions
6. **删除 Session** - 删除指定的 session

---

## 1. 同步已有 Session

通过在消息中包含 `session` 字段来指定使用已有的 session key：

### 请求格式

```json
{
  "id": "msg-001",
  "content": "继续我们之前的对话",
  "session": "my-custom-session-key"
}
```

### 使用场景

- 多个用户使用同一个自定义 session key 进行对话
- 从外部系统管理 session key
- 实现跨设备对话同步

---

## 2. 自动创建 Session

如果不指定 `session` 字段，bridge 会根据 session scope 自动生成 session key：

### Per-Sender 模式（默认）

每个消息 ID 生成唯一的 session key：

```json
{
  "id": "msg-123",
  "content": "开始新对话"
}
```

→ 生成的 session key: `webhook:msg-123`

### Global 模式

所有消息共享同一个 session key：

```json
{
  "id": "msg-456",
  "content": "在全局会话中发言"
}
```

→ 使用的 session key: `global`

---

## 3. 重置 Session

### 方法 1: 使用重置命令

发送 `/new` 或 `/reset` 命令来重置当前 session：

```json
{
  "id": "msg-789",
  "content": "/new"
}
```

或者带消息内容：

```json
{
  "id": "msg-790",
  "content": "/new 开始新的话题"
}
```

### 方法 2: 使用控制消息

```json
{
  "type": "session.reset",
  "key": "webhook:msg-123"
}
```

### 响应格式

```json
{
  "type": "session.reset",
  "data": {
    "success": true,
    "key": "webhook:msg-123"
  }
}
```

---

## 4. 查询 Session 信息

### 请求格式

```json
{
  "type": "session.get",
  "key": "webhook:msg-123"
}
```

或使用 session ID：

```json
{
  "type": "session.get",
  "id": "sess_1234567890"
}
```

### 响应格式

```json
{
  "type": "session.get",
  "data": {
    "key": "webhook:msg-123",
    "sessionId": "sess_1234567890",
    "updatedAt": 1699000000000,
    "deliveryContext": {
      "channel": "webhook",
      "to": "msg-123",
      "accountId": "abc-123-def"
    },
    "lastChannel": "webhook",
    "lastTo": "msg-123"
  }
}
```

---

## 5. 列出所有 Sessions

### 请求格式

```json
{
  "type": "session.list"
}
```

### 响应格式

```json
{
  "type": "session.list",
  "data": {
    "sessions": [
      {
        "key": "webhook:msg-001",
        "sessionId": "sess_1111111111",
        "updatedAt": 1699000000000,
        "lastChannel": "webhook",
        "lastTo": "msg-001"
      },
      {
        "key": "webhook:msg-002",
        "sessionId": "sess_2222222222",
        "updatedAt": 1699000100000,
        "lastChannel": "webhook",
        "lastTo": "msg-002"
      }
    ],
    "count": 2
  }
}
```

---

## 6. 删除 Session

### 请求格式

```json
{
  "type": "session.delete",
  "key": "webhook:msg-123"
}
```

### 响应格式

```json
{
  "type": "session.delete",
  "data": {
    "success": true,
    "key": "webhook:msg-123"
  }
}
```

---

## Session Key 格式

### 自动生成的格式

- **Per-Sender 模式**: `webhook:{messageId}`
- **Global 模式**: `global`

### 自定义格式

可以使用任何字符串作为自定义 session key（会被转为小写）：

```json
{
  "id": "msg-001",
  "content": "Hello",
  "session": "user-123-conversation"
}
```

→ session key: `user-123-conversation`

---

## 7. Webhook 话题/会话路由（Telegram 风格）

如果不传 `session`，也可以通过「会话路由字段」让 webhook 自动生成与 Telegram 类似的 session key。

支持字段（任选其一组合即可）：

- `peerKind`: `dm` | `group` | `channel`
- `peerId`: 目标 ID（用户/群/频道）
- `topicId`: 话题/主题 ID（仅 `group/channel` 生效，生成 `:topic:` 后缀）
- `threadId`: 线程 ID（`dm` 时生成 `:thread:` 后缀；`group/channel` 时会在缺少 `topicId` 时视作 topic）
- `chatType`/`chatId`: `peerKind`/`peerId` 的别名
- `senderId`: 当 `peerKind` 为空时作为 `dm` 的 `peerId`

### 示例：群组话题（topic）

```json
{
  "id": "msg-1001",
  "content": "群里聊新话题",
  "peerKind": "group",
  "peerId": "-1001234567890",
  "topicId": "42"
}
```

→ session key: `agent:main:webhook:group:-1001234567890:topic:42`

### 示例：DM 线程（thread）

```json
{
  "id": "msg-1002",
  "content": "继续这个私聊线程",
  "peerKind": "dm",
  "peerId": "user-abc",
  "threadId": "99"
}
```

→ session key: `agent:main:webhook:dm:user-abc:thread:99`

### 说明

- `session` 字段依然优先（显式 session 会覆盖上述自动生成逻辑）。
- 未提供路由字段时，仍按原有 session scope 规则生成（`webhook:{id}` / `global`）。

## Session 持久化

Sessions 会自动持久化到 `~/.openclaw/sessions.json`：

```json
{
  "webhook:msg-001": {
    "sessionId": "sess_1234567890",
    "updatedAt": 1699000000000,
    "deliveryContext": {
      "channel": "webhook",
      "to": "msg-001"
    },
    "webhookMessageId": "msg-001",
    "webhookSessionId": "webhook:msg-001"
  }
}
```

Bridge 重启后会自动恢复所有 sessions。

---

## 完整示例

### 客户端代码示例 (Python)

```python
import asyncio
import websockets
import json

async def webhook_client():
    uri = "ws://localhost:8080/ws"
    async with websockets.connect(uri) as websocket:
        # 1. 发送普通消息（自动创建 session）
        msg1 = {
            "id": "msg-001",
            "content": "你好，我是新用户"
        }
        await websocket.send(json.dumps(msg1))
        response1 = await websocket.recv()
        print(f"收到响应: {response1}")

        # 2. 继续同一 session 的对话
        msg2 = {
            "id": "msg-002",
            "content": "你刚才说了什么？",
            "session": "webhook:msg-001"
        }
        await websocket.send(json.dumps(msg2))
        response2 = await websocket.recv()
        print(f"收到响应: {response2}")

        # 3. 重置 session
        msg3 = {
            "id": "msg-003",
            "content": "/new 让我们重新开始"
        }
        await websocket.send(json.dumps(msg3))
        response3 = await websocket.recv()
        print(f"收到响应: {response3}")

        # 4. 查询 session 信息
        query = {
            "type": "session.get",
            "key": "webhook:msg-001"
        }
        await websocket.send(json.dumps(query))
        info = await websocket.recv()
        print(f"Session 信息: {info}")

        # 5. 列出所有 sessions
        list_query = {
            "type": "session.list"
        }
        await websocket.send(json.dumps(list_query))
        all_sessions = await websocket.recv()
        print(f"所有 Sessions: {all_sessions}")

asyncio.run(webhook_client())
```

---

## 注意事项

1. **Session Key 大小写**: 自定义 session key 会自动转为小写
2. **控制消息优先**: 控制消息（`type` 字段）会在普通消息之前处理
3. **响应格式**: 所有控制消息响应都包含 `type` 和 `data` 字段
4. **并发安全**: Session store 使用文件锁确保并发访问安全
5. **缓存机制**: Session 数据有 45 秒的内存缓存，提升性能

---

## 配置选项

在 `~/.openclaw/bridge.json` 中可以配置 session scope：

```json
{
  "webhook_url": "ws://localhost:8080/ws",
  "agent_id": "main",
  "session_scope": "per-sender"  // 或 "global"
}
```

- **per-sender**: 每个消息 ID 有独立 session（默认）
- **global**: 所有消息共享一个全局 session
