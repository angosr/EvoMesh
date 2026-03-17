---
from: user
priority: P0
type: directive
date: 2026-03-17T02:30
---

# 右侧面板完全重新设计 — 当前设计完全无用

## 问题
当前 4 个 tab（Activity/Issues/Tasks/Central AI）看起来花哨但完全不产生生产力：
- Central Status 重复出现在两个地方
- Issues 和 Tasks 的信息似是而非，看到了也不知道怎么用
- 没有实时推送，不知道角色正在干什么
- 没有流式反馈，发消息后只有 "Delivered to inbox"

## 新设计：统一消息流（像群聊）

### 结构
删除所有 tab。只有一个东西：**消息流 + 输入框**。

### 消息流内容（按时间倒序，新的在下面）
1. **角色动态**：每个角色完成一轮 loop 后，自动推送一条消息到 feed
   - 格式：`[角色名] 时间 — 做了什么`
   - 来源：Server 检测 memory/short-term.md 变化 → SSE 推送到前端
2. **Central AI 汇报**：Central AI 每轮 loop 后的 status 摘要
3. **用户消息**：用户在输入框发的消息
4. **Central AI 回复**：Central AI 处理用户消息后的反馈

### 技术方案

#### Server 端
新增 SSE endpoint：`GET /api/feed/stream`
- 每 5 秒检查所有角色的 memory/short-term.md
- 对比上次快照，如果内容变了 → 推送变化
- 格式：`{ role: "core-dev", project: "EvoMesh", text: "实现了 dual launch mode", time: "2min ago" }`
- Central AI status 变化也推送
- 用户消息也通过此 feed 推送（发送时 Server echo 回来）

#### 前端
- 删除 mc-tabs, mc-activity, mc-issues, mc-tasks, mc-central 所有 DOM
- 替换为：一个 `#feed` div + 一个 `#input` div
- 用 EventSource 连接 SSE
- 每条消息 append 到 feed 底部，自动滚动
- 用户消息用不同样式（靠右、蓝色背景）
- 角色消息用角色颜色标签

#### 输入框
- 发送到 `/api/admin/message`（已有）
- 发送后立即在 feed 显示 "You: xxx"
- Central AI 处理后的回复通过 SSE 推送回来

### 删除的东西
- 删除 Activity tab（功能被消息流替代）
- 删除 Issues tab（角色自己在 feed 里报告问题）
- 删除 Tasks tab（lead 在 feed 里分派任务可见）
- 删除 Central AI Status tab（Central AI 的汇报直接在 feed 里）
- 删除 `refreshMissionControl()`、`renderMCFromState()`、所有 mc-* 函数

## 分派
- core-dev: SSE feed endpoint
- frontend: 前端消息流 UI
- 两个角色并行开发，core-dev 先提供 API
