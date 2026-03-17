---
from: user
priority: P0
type: directive
date: 2026-03-17T03:00
---

# Central AI 必须即时回复用户消息

## 核心问题
用户发消息到右侧面板 → "Delivered to inbox" → 等 5 分钟 → Central AI 在 loop 里处理 → 写到 status 文件 → 用户不知道有没有回复。

这不是对话，是邮件。用户期望的是即时对话。

## 解决方案

### Central AI ROLE.md 修改
当 Central AI 看到 `[URGENT]` 前缀的输入时（通过 tmux send-keys 注入的用户消息），必须：
1. 立即停止当前工作
2. 处理用户消息
3. 把回复写到 `~/.evomesh/central/reply.md`（不是 status 文件）
4. Server 检测 reply.md 变化 → SSE 推送给前端

### Server 修改（core-dev）
1. SSE feed 监控 `~/.evomesh/central/reply.md` 的 mtime
2. 变化时读取内容 → 推送 `{ type: "central-reply", text: ... }` 到 feed
3. 推送后清空 reply.md（避免重复推送）

### 前端修改（frontend）
Central AI reply 在 feed 里用特殊样式显示（红色标签 + 左对齐 + 高亮背景）

## 效果
用户发消息 → 1-2 秒 tmux 注入 → Central AI 看到 [URGENT] → 处理 → 写 reply.md → Server 5 秒内检测 → SSE 推送 → 前端显示

总延迟：~10 秒（不是 5 分钟）

## 分派
- 修改 Central AI ROLE.md：加 [URGENT] 处理规则
- core-dev：SSE 监控 reply.md
- frontend：central-reply 样式
