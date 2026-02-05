# Commands 功能使用指南

## 概述

OpenClaw Webhook Bridge 现已支持类似 Telegram 的斜杠命令功能。用户可以通过小程序输入命令来获取帮助、查看可用命令列表、运行技能等。

## 可用命令

### 基础命令

#### `/help` - 获取帮助
显示所有可用命令的快速概览。

**示例:**
```
输入: /help

输出:
**Available Commands:**

🔹 **/help** - Show this help message
🔹 **/commands** - List all available commands
🔹 **/skill [name]** - List skills or run a specific skill
🔹 **/approve [id]** - Approve or deny pending requests

💡 Use /commands to see the full command list
💡 Use /skill to see all available skills
```

#### `/commands` - 列出所有命令
从 OpenClaw Gateway 获取完整的命令列表，按类别分组展示。

**示例:**
```
输入: /commands

输出:
**Available Commands:**

**📊 Status**
  /help - Show available commands.
  /commands - List all slash commands.
  /status - Show current status.
  /whoami - Show your sender id.
  /context - Explain how context is built and used.

**🛠️ Tools**
  /skill - Run a skill by name.

**⚙️ Management**
  /approve - Approve or deny exec requests.
  /subagents - List/stop/log/info subagent runs.
  /config - Show or set config values.
  /allowlist - List/add/remove allowlist entries.

**🎵 Media**
  /tts - Control text-to-speech (TTS).
```

### 技能管理

#### `/skill` - 列出所有技能
不带参数时显示所有可用的技能列表。

**示例:**
```
输入: /skill

输出:
**Available Skills:**

🔧 **web-search**
   Search the web for information
   Usage: `/skill web-search [query]`

🔧 **code-analyzer**
   Analyze code for issues
   Usage: `/skill code-analyzer [path]`

🔧 **document-generator**
   Generate documentation from code
   Usage: `/skill document-generator [source]`
```

#### `/skill <name> [args]` - 运行指定技能
运行特定的技能并传递参数。

**示例:**
```
输入: /skill web-search latest AI breakthroughs 2024

处理: 运行 web-search 技能，搜索 "latest AI breakthroughs 2024"
输出: (技能执行结果)
```

### 审批管理

#### `/approve <request-id> [yes|no]` - 审批请求
批准或拒绝待处理的操作请求。

**参数:**
- `request-id`: 请求的唯一标识符
- `yes|no`: 批准(yes)或拒绝(no)，默认为批准

**示例:**
```
输入: /approve req-12345
输出: Request req-12345 has been approved

输入: /approve req-12346 no
输出: Request req-12346 has been denied
```

## 小程序界面集成

### CommandPanel 组件

新增的 `CommandPanel` 组件提供了可视化的命令和技能浏览界面。

**功能特性:**
- 📋 **Commands Tab**: 按类别分组显示所有可用命令
- 🔧 **Skills Tab**: 展示所有可用技能及其用法
- 🔍 **实时搜索**: (未来功能) 快速查找命令
- 📱 **点击执行**: 点击命令/技能自动填充到输入框

**使用方法:**

1. **在聊天页面中集成:**
```tsx
import CommandPanel from '../../components/CommandPanel'

// 在组件中使用
<CommandPanel 
  onCommandSelect={(command) => {
    // 自动填充到输入框或直接执行
    this.handleCommandSelected(command)
  }}
/>
```

2. **作为弹出面板:**
```tsx
// 点击按钮显示命令面板
<Button onClick={() => this.showCommandPanel()}>
  📋 Commands
</Button>

{showCommandPanel && (
  <View className='command-panel-overlay'>
    <CommandPanel onCommandSelect={this.handleCommandSelected} />
  </View>
)}
```

### 集成到现有聊天页面

在 `openclaw-mapp/src/pages/chat/index.tsx` 中添加命令面板：

```tsx
import CommandPanel from '../../components/CommandPanel'

// 在 state 中添加
state = {
  // ... 其他状态
  showCommandPanel: false
}

// 添加切换方法
toggleCommandPanel = () => {
  this.setState({ 
    showCommandPanel: !this.state.showCommandPanel 
  })
}

// 处理命令选择
handleCommandSelected = (command: string) => {
  // 方式1: 直接执行命令
  this.props.chatStore.sendMessage(command)
  
  // 方式2: 填充到输入框
  this.inputContent = command
  this.forceUpdate()
  
  // 关闭面板
  this.setState({ showCommandPanel: false })
}

// 在 render 中添加
render() {
  const { showCommandPanel } = this.state
  
  return (
    <View className='chat-page'>
      <ChatHeader 
        onCommandsClick={this.toggleCommandPanel}
      />
      
      {showCommandPanel && (
        <View className='command-panel-modal'>
          <CommandPanel 
            onCommandSelect={this.handleCommandSelected}
          />
        </View>
      )}
      
      {/* 其他组件 */}
    </View>
  )
}
```

## 后端实现细节

### 命令检测和路由

Bridge 会自动检测以 `/` 开头的消息作为命令：

```go
// 在 bridge.go 中
if commands.IsCommand(msg.Content) {
    return b.handleCommand(msg.Content, msg.Session, msg.ID)
}
```

### 命令处理流程

1. **解析命令**: 提取命令名称和参数
2. **路由到处理器**: 根据命令类型调用相应处理函数
3. **与 OpenClaw 通信**: 对于需要数据的命令(如 /commands, /skill)，通过 WebSocket 向 OpenClaw Gateway 发送请求
4. **格式化响应**: 将返回数据格式化为友好的文本
5. **发送响应**: 通过 Webhook 返回给小程序

### OpenClaw Gateway 通信

使用请求/响应模式与 OpenClaw 通信：

```go
// 发送请求并等待响应
response, err := c.sendRequestAndWait(
    "agent.listSkills",     // 方法名
    params,                  // 参数
    5*time.Second           // 超时
)
```

**支持的 Gateway 方法:**
- `agent.listSkills` - 获取技能列表
- `system.listCommands` - 获取命令列表
- `approval.respond` - 发送审批决定

## 测试步骤

### 1. 启动环境

```bash
# 1. 启动 OpenClaw Gateway (在 openclaw 目录)
cd /path/to/openclaw
openclaw start

# 2. 启动 Bridge (在 moltbotCNAPP 目录)
cd /path/to/moltbotCNAPP
make build
./openclaw-bridge run

# 3. 启动 Webhook 服务 (开发环境)
cd node-webhook
npm start

# 4. 启动小程序 (开发环境)
cd openclaw-mapp
pnpm dev:weapp
```

### 2. 测试命令

在微信开发者工具中打开小程序，依次测试：

1. **测试 /help**
   ```
   输入: /help
   预期: 显示帮助信息
   ```

2. **测试 /commands**
   ```
   输入: /commands
   预期: 显示完整命令列表，按类别分组
   ```

3. **测试 /skill**
   ```
   输入: /skill
   预期: 显示所有可用技能
   ```

4. **测试运行技能**
   ```
   输入: /skill web-search OpenAI GPT-5
   预期: 执行搜索技能并返回结果
   ```

5. **测试 /approve**
   ```
   输入: /approve req-test-123 yes
   预期: 显示审批成功消息
   ```

### 3. 检查日志

查看 Bridge 日志确认命令处理：

```bash
# Bridge 日志
tail -f ~/.openclaw/bridge.log

# 预期看到类似输出:
[Commands] Processing command: /help args: 
[Commands] Processing command: /commands args: 
[OpenClaw] Fetching commands list
[OpenClaw] Retrieved 15 commands
```

## 故障排除

### 命令没有响应

1. **检查 Bridge 是否运行**
   ```bash
   ./openclaw-bridge status
   ```

2. **检查 OpenClaw Gateway 连接**
   ```bash
   # 查看日志
   tail -f ~/.openclaw/bridge.log
   
   # 应该看到连接成功消息
   [OpenClaw] Connected to gateway
   ```

3. **检查 WebSocket 连接**
   - 确保 Webhook 服务正在运行
   - 确认 UID 配置正确

### 命令返回错误

1. **检查 OpenClaw Gateway 是否启动**
   ```bash
   # 测试 Gateway 是否响应
   curl http://localhost:18789/health
   ```

2. **检查权限和配置**
   - 确保 Gateway token 配置正确
   - 检查 `~/.openclaw/openclaw.json` 配置

### 技能列表为空

1. **确认 agent 配置了 skills**
   - 检查 `~/.openclaw/agents/main/skills/` 目录
   - 确保 skills 已正确注册

2. **检查 agent ID**
   - Bridge 配置的 agent_id 应与实际 agent 匹配

## 未来改进

- [ ] 添加命令自动补全
- [ ] 支持命令别名
- [ ] 添加命令帮助详情页
- [ ] 实现命令历史记录
- [ ] 支持更多交互式命令
- [ ] 添加命令执行进度提示
- [ ] 支持命令参数验证
- [ ] 实现权限控制

## 相关文档

- [COMMANDS.md](./COMMANDS.md) - 技术实现文档
- [README.md](./README.md) - 项目总览
- [SESSION_CONTROL.md](./SESSION_CONTROL.md) - Session 管理
- [AGENTS.md](./AGENTS.md) - 开发指南
