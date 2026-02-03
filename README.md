# OpenClaw Bridge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8?flat&logo=go)](https://go.dev/)

连接 WebSocket Webhook 服务与 OpenClaw AI Agent 的桥接服务。

## 前置要求

- OpenClaw Gateway 正在本地运行（默认端口 18789，配置在 `~/.openclaw/openclaw.json` 或者 `~/.openclaw/openclaw.json`）
- 一个 WebSocket 服务端用于接收消息和发送响应

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
cd moltbotCNAPP
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

凭据保存后，直接使用：

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

### 查看日志

```bash
tail -f ~/.openclaw/bridge.log
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
./openclaw-bridge run

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
