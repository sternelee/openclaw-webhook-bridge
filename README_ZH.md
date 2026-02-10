# OpenClaw Bridge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Rust Version](https://img.shields.io/badge/Rust-1.70+-orange?flat&logo=rust)](https://www.rust-lang.org)

> **[English](README.md) | [简体中文](README_ZH.md)**

OpenClaw 是一个 AI Agent Gateway 系统，openclaw-run 是其官方桥接实现，包含 Rust 桥接服务、Cloudflare Workers Webhook 和 Web 前端应用。

## 系统架构

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│ WeChat Mini-    │◄──────────────────►│ Cloudflare       │
│ Program (Taro)  │    (ws://...?uid)  │ Workers Webhook  │
└─────────────────┘                     └────────┬─────────┘
                                                │
┌─────────────────┐                           │
│ Next.js Web App │◄──────────────────────────┘
│ (OpenNext/CF)   │
└─────────────────┘
                                                │
                                                ▼
                                       ┌──────────────────┐
                                       │ OpenClaw Bridge  │
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

## 组件说明

| 组件 | 目录 | 技术栈 | 说明 |
|------|------|--------|------|
| **OpenClaw Bridge** | `src/` | Rust | 连接 Webhook 和 OpenClaw Gateway 的守护进程 |
| **Cloudflare Workers Webhook** | `cloudflare-webhook/` | Hono + DO | 生产环境 WebSocket 服务 |
| **Web App** | `openclaw-app/` | Next.js 16 + OpenNext | 移动端优化的 Web 界面 |
| **WeChat Mini-Program** | `openclaw-mapp/` | Taro + React | 微信小程序前端 |

### OpenClaw Bridge 特性

- **高性能**: 异步 I/O、类型安全、零成本抽象
- **轻量级**: 二进制大小 ~2.7MB (stripped)，内存占用 2-3MB
- **跨平台**: Linux, macOS, Windows
- **可靠连接**: 自动重连、指数退避、会话持久化
- **多实例支持**: UID 路由机制支持多桥接实例

### openclaw-app 特性

- **移动端优化**: 响应式设计、触摸友好、安全区域适配
- **功能页面**:
  - Chat - 流式对话界面
  - Sessions - 会话管理
  - Channels - 通道配置（WhatsApp、Nostr、Telegram 等）
  - Nodes - 设备和节点管理
  - Config - 配置编辑（表单/JSON5）
  - Debug - RPC 调用和事件日志
  - Overview - 连接状态概览

## 快速开始

### 前置要求

- OpenClaw Gateway 正在本地运行（默认端口 18789）
- 配置文件位置: `~/.openclaw/`

### 安装 Bridge

#### 预编译二进制

从 [Releases](https://github.com/sternelee/openclaw-run/releases) 下载对应平台的二进制文件。

#### 从源码编译

```bash
git clone https://github.com/sternelee/openclaw-run.git
cd openclaw-run
cargo build --release
```

编译后的二进制文件位于 `target/release/openclaw-bridge`。

### 使用 Bridge

```bash
# 首次启动（会提示输入配置）
./openclaw-bridge start

# 后台启动
./openclaw-bridge start

# 日常管理
./openclaw-bridge stop      # 停止
./openclaw-bridge restart   # 重启
./openclaw-bridge status    # 查看状态
./openclaw-bridge run       # 前台运行
```

### 配置文件

配置保存在 `~/.openclaw/bridge.json`：

```json
{
  "webhook_url": "ws://localhost:8787/ws",
  "agent_id": "main",
  "uid": "auto-generated-uuid-v4"
}
```

### 日志

```bash
tail -f ~/.openclaw/bridge.log
```

通过 `RUST_LOG` 环境变量设置日志级别：

```bash
RUST_LOG=info ./openclaw-bridge run     # 默认
RUST_LOG=debug ./openclaw-bridge run    # 详细
RUST_LOG=warn ./openclaw-bridge run    # 安静
```

## Cloudflare Workers Webhook

```bash
cd cloudflare-webhook
pnpm install
pnpm dev      # 本地开发
pnpm deploy   # 部署到 Cloudflare
pnpm tail     # 实时日志
```

## openclaw-app

```bash
cd openclaw-app
pnpm install
pnpm dev          # 本地开发 (localhost:3000)
pnpm build        # 构建生产版本
pnpm deploy       # 部署到 Cloudflare (OpenNext)
```

## openclaw-mapp (微信小程序)

```bash
cd openclaw-mapp
pnpm install
pnpm dev:weapp    # 开发
```

在微信开发者工具中导入 `dist/` 目录。

## WebSocket 协议

### 客户端发送消息格式

```json
{
  "id": "unique-message-id",
  "content": "用户消息内容",
  "session": "optional-session-id"
}
```

### 服务端响应格式

**流式更新 (progress)**
```json
{
  "type": "progress",
  "content": "当前的回复内容",
  "session": "session-id"
}
```

**完成 (complete)**
```json
{
  "type": "complete",
  "content": "最终回复内容",
  "session": "session-id"
}
```

## UID 路由机制

所有 WebSocket 连接使用 UID（唯一标识符）进行路由：

1. Bridge 启动时自动生成 UUID v4
2. 客户端连接时附加 `?uid=xxx` 查询参数
3. Durable Object 使用 `Map<UID, Set<WebSocket>>` 进行内部路由

这允许多个 Bridge 实例连接到同一个 Webhook 服务器。

## 开发

```bash
# Bridge
make fmt        # 格式化代码
make clippy     # 静态分析
make lint       # fmt + clippy
make test       # 运行测试
make build      # 编译当前平台
make build-all  # 编译所有平台
```

## 事件处理

Bridge 正确处理以下 OpenClaw Gateway 事件：

- **agent**: AI 流式响应事件（lifecycle, assistant, tool）
- **chat**: 聊天消息事件（delta, final, error）
- **event**: 系统事件（ticket, heartbeat, heart 等）
- 其他事件类型会透传并记录日志

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 相关项目

- [OpenClaw Gateway](https://github.com/openclaw/gateway) - AI Agent Gateway
- [openclaw/ui](https://github.com/openclaw/ui) - 参考的 Web UI 实现
