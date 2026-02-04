# OpenClaw Bridge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8?flat&logo=go)](https://go.dev/)

连接 WebSocket Webhook 服务与 OpenClaw AI Agent 的桥接服务。

## 前置要求

- OpenClaw Gateway 正在本地运行（默认端口 18789，配置在 `~/.openclaw/openclaw.json`）
- 一个 WebSocket 服务端用于接收消息和发送响应（Webhook 服务）

## 安装

#### 预编译二进制

**Linux (amd64)**
```bash
curl -sLO https://github.com/sternelee/openclaw-webhook-bridge/releases/latest/download/openclaw-bridge-linux-amd64 && mv openclaw-bridge-linux-amd64 openclaw-bridge && chmod +x openclaw-bridge
```

**Linux (arm64)**
```bash
curl -sLO https://github.com/sternelee/openclaw-webhook-bridge/releases/latest/download/openclaw-bridge-linux-arm64 && mv openclaw-bridge-linux-arm64 openclaw-bridge && chmod +x openclaw-bridge
```

**macOS (arm64 / Apple Silicon)**
```bash
curl -sLO https://github.com/sternelee/openclaw-webhook-bridge/releases/latest/download/openclaw-bridge-darwin-arm64 && mv openclaw-bridge-darwin-arm64 openclaw-bridge && chmod +x openclaw-bridge
```

**macOS (amd64 / Intel)**
```bash
curl -sLO https://github.com/sternelee/openclaw-webhook-bridge/releases/latest/download/openclaw-bridge-darwin-amd64 && mv openclaw-bridge-darwin-amd64 openclaw-bridge && chmod +x openclaw-bridge
```

**Windows (amd64)**
```powershell
Invoke-WebRequest -Uri https://github.com/sternelee/openclaw-webhook-bridge/releases/latest/download/openclaw-bridge-windows-amd64.exe -OutFile openclaw-bridge.exe
```

也可以直接从 [Releases](https://github.com/sternelee/openclaw-webhook-bridge/releases) 页面手动下载。

#### 从源码编译

```bash
git clone https://github.com/sternelee/openclaw-webhook-bridge.git
cd openclaw-webhook-bridge
go build -o openclaw-bridge ./cmd/bridge/
```

## 使用

### 首次启动

传入 WebSocket URL，会自动保存到 `~/.openclaw/bridge.json`：

```bash
./openclaw-bridge start webhook_url=ws://localhost:8080/ws
```

或者不传入参数，程序会提示输入：

```bash
./openclaw-bridge start
# Enter WebSocket URL (e.g., ws://localhost:8080/ws): ws://localhost:8080/ws
```

### 日常管理

配置保存后，直接使用：

```bash
./openclaw-bridge start     # 后台启动
./openclaw-bridge stop      # 停止
./openclaw-bridge restart   # 重启
./openclaw-bridge status    # 查看状态
./openclaw-bridge run       # 前台运行（方便调试）
```

### 可选参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `webhook_url` | WebSocket 服务端 URL | — |
| `agent_id` | OpenClaw Agent ID | `main` |

`uid` 不在命令行参数中提供，默认启动时自动生成；如需固定 UID，可手动写入 `~/.openclaw/bridge.json`：

```json
{
  "webhook_url": "ws://localhost:8080/ws",
  "agent_id": "main",
  "uid": "your-stable-uid"
}
```

### 查看日志

```bash
tail -f ~/.openclaw/bridge.log
```

## WebSocket 协议

桥接服务连接 WebSocket 时会在 URL 上追加 `uid` 查询参数（例如 `ws://localhost:8080/ws?uid=...`），用于服务端区分多个桥接实例。

### 客户端发送消息格式

```json
{
  "id": "unique-message-id",
  "content": "用户消息内容",
  "session": "optional-session-id",
  "peerKind": "dm | group | channel",
  "peerId": "peer-id",
  "topicId": "optional-topic-id",
  "threadId": "optional-thread-id"
}
```

字段说明：
- `id`: 必填，消息唯一标识，用于去重
- `content`: 必填，消息内容
- `session`: 可选，会话 ID（显式优先）
- `peerKind`/`peerId`/`topicId`/`threadId`: 可选，会话路由字段；当 `session` 为空时用于构造 Telegram 风格 Session
  - 群/频道话题：`peerKind=group|channel` + `peerId` + `topicId` → `:topic:`
  - 私聊线程：`peerKind=dm` + `peerId` + `threadId` → `:thread:`

桥接服务会忽略控制消息（`type` 为 `connected`、`error`、`event` 的 payload），避免将非用户消息转发给 OpenClaw。

### 控制消息：会话列表

客户端可发送 `session.list` 获取当前会话列表：

```json
{ "type": "session.list" }
```

响应格式：

```json
{
  "type": "session.list",
  "data": {
    "sessions": [
      { "key": "agent:main:webhook:group:xxx:topic:42", "updatedAt": 1700000000000 }
    ],
    "count": 1
  }
}
```

### 服务端响应格式

响应有三种类型：`progress`（流式更新）、`complete`（完成）、`error`（错误）

#### 流式更新 (progress)

```json
{
  "type": "progress",
  "content": "当前的回复内容",
  "session": "session-id"
}
```

#### 完成 (complete)

```json
{
  "type": "complete",
  "content": "最终回复内容",
  "session": "session-id"
}
```

#### 错误 (error)

```json
{
  "type": "error",
  "error": "错误信息",
  "session": "session-id"
}
```

## 项目架构

OpenClaw Bridge 由三个主要组件构成：

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│ WeChat Mini-    │◄──────────────────►│ Cloudflare       │
│ Program (Taro)  │    (ws://...?uid)  │ Workers Webhook  │
└─────────────────┘                     └────────┬─────────┘
                                                │
                                                │ Durable Object
                                                │ (single global,
                                                │  routes by UID)
                                                ▼
                                       ┌──────────────────┐
                                       │ Go Bridge         │
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

### 组件说明

| 组件 | 目录 | 说明 |
|------|------|------|
| **Go Bridge** | `cmd/bridge/`, `internal/` | 生产级守护进程，连接 Webhook 和 OpenClaw Gateway |
| **Cloudflare Workers** | `cloudflare-webhook/` | 基于 Durable Objects 的 WebSocket 服务，支持多实例路由 |
| **Node.js Webhook** | `node-webhook/` | 本地测试用 WebSocket 服务器 |
| **WeChat Mini-Program** | `openclaw-mapp/` | Taro + React 的微信小程序前端 |

### UID 路由机制

所有 WebSocket 连接使用 UID（唯一标识符）进行路由：

1. Bridge 启动时自动生成 UUID v4 并保存到 `~/.openclaw/bridge.json`
2. 小程序在设置页面输入 Bridge UID
3. 连接时附加 `?uid=xxx` 查询参数
4. Durable Object 使用 `Map<UID, Set<WebSocket>>` 进行内部路由

这种设计允许多个 Bridge 实例连接到同一个 Webhook 服务器而不会冲突。

## 开发

### Go Bridge

```bash
# 前台运行（日志直接输出到终端）
./openclaw-bridge run

# 编译所有平台
./scripts/build.sh

# 代码检查
make fmt      # 格式化代码
make vet      # 静态分析
make lint     # fmt + vet
make test     # 运行测试
```

### Cloudflare Workers Webhook

项目包含基于 Cloudflare Workers 和 Durable Objects 的 WebSocket 服务，用于生产环境部署：

```bash
cd cloudflare-webhook

# 本地开发
pnpm dev

# 部署到 Cloudflare
pnpm deploy

# 实时日志
pnpm tail
```

**架构说明**：
- 使用 Hono 框架处理 HTTP/WebSocket 路由
- 单个全局 Durable Object 管理 WebSocket 连接
- 基于 UID 的内部路由机制（`Map<UID, Set<WebSocket>>`）
- 支持连接休眠（hibernation）以节省内存

### Node.js 本地测试服务器

用于本地测试，无需 Cloudflare：

```bash
cd node-webhook
npm install
npm start
```

测试页面：http://localhost:8080

## openclaw-mapp（小程序前端）

`openclaw-mapp` 是配套的小程序前端，支持：
- 左侧会话栏（Session 列表）+ 手动刷新
- 会话切换后仅显示该 Session 消息
- 通过 `session.list` 从桥接服务拉取会话列表

### 小程序使用说明：会话/Topic 并发与 Telegram 最佳实践

OpenClaw 的并发能力基于 **Session**：
- 一条 Session = 一条独立任务流（独立上下文）
- 多条 Session = 同时处理多条任务

在 Telegram 里，最简单的“多 Session”入口就是 **Topics**：
- 一个群开启多个 Topic
- 每个 Topic 对应一条独立 Session
- 一个群 = 多条并行车道

#### 推荐的「任务分车道」设计

给小白的默认建议：
- **Chat**：日常聊天（上下文自由发散）
- **Work**：办正事（只讨论任务/指令）
- **Feed**：资讯/巡逻（低打扰）

效果：
- Chat 的闲聊不影响 Work
- Feed 的噪音不污染 Chat

#### 让机器人在群里“能看到消息”

很多问题并不是 `requireMention=false`，而是 bot 根本收不到群消息。建议同时做：
1. 在 @BotFather 里关闭 Privacy：`/setprivacy → Disable`
2. 把 bot 拉进群后设为管理员：群设置 → 管理员 → 添加 bot

#### 开启 Topics / Forum

在群设置里打开 Topics / Forum，然后创建上面的 Topic（Chat / Work / Feed）。

#### 触发规则（requireMention）

目的：
- 确保每个 Topic 都能独立触发 OpenClaw
- 控制它插话的频率

两种常见策略：

**策略 A：全群都不需要 @**  
适合机器人专用群 / 小群  
设置：`requireMention = false`

**策略 B：只有部分 Topic 不需要 @**  
群默认需要 @（避免乱插话）  
例如 Work / Feed 不需要 @（更像“专用任务车道”）

配置示例：
```json
{
  "channels": {
    "telegram": {
      "groups": {
        "-1001234567890": {
          "requireMention": true,
          "topics": {
            "WorkTopicId": { "requireMention": false },
            "FeedTopicId": { "requireMention": false }
          }
        }
      }
    }
  }
}
```

#### 30 秒验收：你真的“并发多任务”了吗？

1. 在 Chat Topic 说一句  
2. 立刻切到 Work Topic 再说一句  
3. 观察 OpenClaw 是否：
   - 两边都能收到并回复  
   - 回复不串到别的 Topic  
   - 两个 Topic 的上下文互不影响

#### 常见坑

1. **群里完全没反应**：先查 BotFather /setprivacy 是否 Disable，再查 bot 是否是管理员  
2. **私聊正常，群里不正常**：99% 是 privacy/admin/requireMention 组合问题  
3. **回复串台**：Topic ID 配错（或把一个 Topic 当成另一个 Topic）

### 本地开发

```bash
cd openclaw-mapp
pnpm install
pnpm dev:weapp
```

### Tailwind CSS

前端样式已改为 TailwindCSS。构建链路包含：
- `postcss.config.js` 启用 `tailwindcss`
- `tailwind.config.js` 配置 `content`
- `config/index.ts` 里集成 `weapp-tailwindcss/webpack`
- `package.json` 增加 `postinstall` 执行 `weapp-tw patch`

**注意**：请使用 `pnpm` 作为包管理器，因为项目中配置了 pnpm 相关的钩子和依赖。

如需重置或升级 Tailwind 配置，请参考：
- https://docs.taro.zone/en/docs/tailwindcss

## 示例：简单 WebSocket 服务端

```go
package main

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	// 发送测试消息
	msg := map[string]string{
		"id":      "msg-1",
		"content": "你好",
		"session": "test-session",
	}
	conn.WriteJSON(msg)

	// 接收响应
	for {
		var resp map[string]interface{}
		if err := conn.ReadJSON(&resp); err != nil {
			log.Printf("Read error: %v", err)
			break
		}
		log.Printf("Received: %+v", resp)
	}
}

func main() {
	http.HandleFunc("/ws", handleWebSocket)
	log.Println("Server started on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件
