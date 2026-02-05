# Commands Feature Implementation

## Overview

实现了类似 Telegram 扩展的指令功能，支持 `/help`, `/commands`, `/skill`, `/approve` 等命令。

## 实现的功能

### 1. 命令处理器 (`internal/commands/handler.go`)

新增的命令处理器支持以下指令：

#### `/help` - 显示帮助信息
返回所有可用命令的概览，包括：
- `/help` - 显示帮助信息
- `/commands` - 列出所有命令
- `/skill [name]` - 列出或运行技能
- `/approve [id]` - 审批请求

#### `/commands` - 列出所有命令
从 OpenClaw Gateway 获取完整的命令列表，按类别分组：
- 📊 Status (状态)
- 🛠️ Tools (工具)
- ⚙️ Management (管理)
- 🎵 Media (媒体)

#### `/skill` 或 `/skills` - 技能管理
- 不带参数：列出所有可用的 skills
- 带参数：运行指定的 skill（通过 OpenClaw 执行）

#### `/approve` - 审批功能
批准或拒绝待处理的请求：
- `/approve <request-id>` - 批准请求（默认）
- `/approve <request-id> yes` - 明确批准
- `/approve <request-id> no` - 拒绝请求

### 2. OpenClaw 客户端扩展 (`internal/openclaw/client.go`)

添加了与 OpenClaw Gateway 通信的新方法：

```go
// ListSkills 获取 agent 的技能列表
func (c *Client) ListSkills() ([]SkillInfo, error)

// ListCommands 获取系统命令列表
func (c *Client) ListCommands() ([]CommandInfo, error)

// SendApproval 发送审批决定
func (c *Client) SendApproval(requestID string, approved bool) error
```

这些方法使用请求/响应模式，通过 WebSocket 与 OpenClaw Gateway 通信：
- 发送带有唯一 ID 的请求
- 等待带有相同 ID 的响应
- 5 秒超时机制

### 3. Bridge 集成 (`internal/bridge/bridge.go`)

Bridge 已更新以支持命令处理：

```go
// 检测斜杠命令
if commands.IsCommand(msg.Content) {
    return b.handleCommand(msg.Content, msg.Session, msg.ID)
}

// 处理命令并返回响应
func (b *Bridge) handleCommand(content, session, messageID string) error
```

## 数据流

```
小程序前端
    ↓ (发送 "/help")
Webhook (Cloudflare Workers / Node.js)
    ↓ (WebSocket)
Bridge (Go)
    ↓ (检测到命令)
CommandHandler
    ↓ (请求数据)
OpenClaw Gateway
    ↓ (返回 skills/commands 列表)
CommandHandler
    ↓ (格式化响应)
Bridge
    ↓ (WebSocket)
Webhook
    ↓
小程序前端 (显示结果)
```

## 使用示例

### 1. 获取帮助
```
用户输入: /help
响应: 
**Available Commands:**

🔹 **/help** - Show this help message
🔹 **/commands** - List all available commands
🔹 **/skill [name]** - List skills or run a specific skill
🔹 **/approve [id]** - Approve or deny pending requests

💡 Use /commands to see the full command list
💡 Use /skill to see all available skills
```

### 2. 列出所有命令
```
用户输入: /commands
响应:
**Available Commands:**

**📊 Status**
  /help - Show available commands.
  /commands - List all slash commands.
  /status - Show current status.
  /whoami - Show your sender id.

**🛠️ Tools**
  /skill - Run a skill by name.

**⚙️ Management**
  /approve - Approve or deny exec requests.
  /subagents - List/stop/log/info subagent runs for this session.
  /config - Show or set config values.

...
```

### 3. 列出 Skills
```
用户输入: /skill
响应:
**Available Skills:**

🔧 **web-search**
   Search the web for information
   Usage: `/skill web-search [query]`

🔧 **code-analyzer**
   Analyze code for issues
   Usage: `/skill code-analyzer [path]`
```

### 4. 运行 Skill
```
用户输入: /skill web-search latest AI news
处理: 命令被转发到 OpenClaw，执行 web-search skill
```

### 5. 审批请求
```
用户输入: /approve req-12345 yes
响应: Request req-12345 has been approved
```

## OpenClaw Gateway 协议

### 请求格式

#### ListSkills
```json
{
  "type": "req",
  "id": "agent.listSkills:1707123456789",
  "method": "agent.listSkills",
  "params": {
    "agentId": "main"
  }
}
```

#### ListCommands
```json
{
  "type": "req",
  "id": "system.listCommands:1707123456789",
  "method": "system.listCommands",
  "params": {}
}
```

#### SendApproval
```json
{
  "type": "req",
  "id": "approval.respond:1707123456789",
  "method": "approval.respond",
  "params": {
    "requestId": "req-12345",
    "approved": true
  }
}
```

### 响应格式

```json
{
  "type": "response",
  "id": "agent.listSkills:1707123456789",
  "data": {
    "skills": [
      {
        "name": "web-search",
        "description": "Search the web for information",
        "command": "web-search",
        "skillName": "web-search"
      }
    ]
  }
}
```

## 技术实现细节

### 1. 请求/响应模式

OpenClaw 客户端使用 pending requests map 来跟踪待处理的请求：

```go
pendingRequests   map[string]chan []byte
pendingRequestsMu sync.RWMutex
```

- 每个请求分配唯一 ID
- 创建响应通道并注册到 map
- 发送请求
- 等待响应或超时
- 清理 map 中的条目

### 2. 命令解析

```go
func ParseCommand(message string) (command string, args string) {
    // 提取 "/command args" 中的 command 和 args
    // 支持多个空格分隔
}
```

### 3. 响应格式化

命令响应使用 webhook 消息格式：

```go
{
  "type": "complete",
  "content": "formatted response",
  "session": "session-key"
}
```

## 下一步

- [ ] 在小程序前端添加命令面板 UI
- [ ] 添加命令自动补全功能
- [ ] 支持更多命令（如 /config, /subagents 等）
- [ ] 添加命令执行历史记录
- [ ] 实现命令权限控制

## 测试

编译测试：
```bash
make fmt   # 格式化代码 ✅
make vet   # 静态分析 ✅
make build # 编译 (待测试)
```

端到端测试：
1. 启动 OpenClaw Gateway
2. 启动 Bridge
3. 通过小程序发送 `/help`
4. 验证响应正确返回

## 相关文件

- `internal/commands/handler.go` - 命令处理逻辑
- `internal/openclaw/client.go` - OpenClaw 通信扩展
- `internal/bridge/bridge.go` - Bridge 命令集成
- `AGENTS.md` - 更新了开发指南
