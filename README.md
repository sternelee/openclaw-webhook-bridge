# ClawdBot Bridge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8?flat&logo=go)](https://go.dev/)

连接 WebSocket Webhook 服务与 ClawdBot AI Agent 的桥接服务。

## 前置要求

- ClawdBot Gateway 正在本地运行（默认端口 18789，配置在 `~/.clawdbot/clawdbot.json` 或者 `~/.openclaw/openclaw.json`）
- 一个 WebSocket 服务端用于接收消息和发送响应

## 安装

#### 预编译二进制

**Linux (amd64)**
```bash
curl -sLO https://github.com/sternelee/openclaw-webhook-bridge/releases/latest/download/clawdbot-bridge-linux-amd64 && mv clawdbot-bridge-linux-amd64 clawdbot-bridge && chmod +x clawdbot-bridge
```

**Linux (arm64)**
```bash
curl -sLO https://github.com/sternelee/openclaw-webhook-bridge/releases/latest/download/clawdbot-bridge-linux-arm64 && mv clawdbot-bridge-linux-arm64 clawdbot-bridge && chmod +x clawdbot-bridge
```

**macOS (arm64 / Apple Silicon)**
```bash
curl -sLO https://github.com/sternelee/openclaw-webhook-bridge/releases/latest/download/clawdbot-bridge-darwin-arm64 && mv clawdbot-bridge-darwin-arm64 clawdbot-bridge && chmod +x clawdbot-bridge
```

**macOS (amd64 / Intel)**
```bash
curl -sLO https://github.com/sternelee/openclaw-webhook-bridge/releases/latest/download/clawdbot-bridge-darwin-amd64 && mv clawdbot-bridge-darwin-amd64 clawdbot-bridge && chmod +x clawdbot-bridge
```

**Windows (amd64)**
```powershell
Invoke-WebRequest -Uri https://github.com/sternelee/openclaw-webhook-bridge/releases/latest/download/clawdbot-bridge-windows-amd64.exe -OutFile clawdbot-bridge.exe
```

也可以直接从 [Releases](https://github.com/sternelee/openclaw-webhook-bridge/releases) 页面手动下载。

#### 从源码编译

```bash
git clone https://github.com/sternelee/openclaw-webhook-bridge.git
cd moltbotCNAPP
go build -o clawdbot-bridge ./cmd/bridge/
```

## 使用

### 首次启动

传入 WebSocket URL，会自动保存到 `~/.clawdbot/bridge.json`：

```bash
./clawdbot-bridge start webhook_url=ws://localhost:8080/ws
```

或者不传入参数，程序会提示输入：

```bash
./clawdbot-bridge start
# Enter WebSocket URL (e.g., ws://localhost:8080/ws): ws://localhost:8080/ws
```

### 日常管理

凭据保存后，直接使用：

```bash
./clawdbot-bridge start     # 后台启动
./clawdbot-bridge stop      # 停止
./clawdbot-bridge restart   # 重启
./clawdbot-bridge status    # 查看状态
./clawdbot-bridge run       # 前台运行（方便调试）
```

### 可选参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `webhook_url` | WebSocket 服务端 URL | — |
| `agent_id` | ClawdBot Agent ID | `main` |

### 查看日志

```bash
tail -f ~/.clawdbot/bridge.log
```

## WebSocket 协议

### 客户端发送消息格式

```json
{
  "id": "unique-message-id",
  "content": "用户消息内容",
  "session": "optional-session-id"
}
```

字段说明：
- `id`: 必填，消息唯一标识，用于去重
- `content`: 必填，消息内容
- `session`: 可选，会话 ID，如果不提供则使用消息 ID

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

## 开发

```bash
# 前台运行（日志直接输出到终端）
./clawdbot-bridge run

# 编译所有平台
./scripts/build.sh
```

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
