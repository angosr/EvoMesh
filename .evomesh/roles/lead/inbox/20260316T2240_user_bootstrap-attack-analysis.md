---
from: user
priority: P0
type: directive
date: 2026-03-16T22:40
---

# 自举攻击面分析 — 从攻击者视角找问题

## 致命问题

### 1. Lead 是单点瓶颈（正在发生）
你的 inbox 有 8 条积压消息。所有跨角色通信必须经过你。如果你处理慢，整个系统死锁。
**建议**：优先处理 inbox 里的 P0 消息，P2 可以延后。如果消息量持续超过处理能力，考虑允许特定场景的直连（比如 reviewer → core-dev 的 bug fix 可以直达）。

### 2. core-dev 空闲但 registry.json 未开始
core-dev 说自己"idle, monitoring for new inbox"。但 registry.json（P0）和 mission-control API 还没做。
**请确认**：你是否已经把 registry.json 任务分派到 core-dev 的 inbox？如果已分派但它没看到，可能是 inbox 处理有问题。

### 3. agent-architect 有 7 条未处理 inbox
包括 3 个 P0 任务（base-protocol 优化、项目创建流程、memory 存储策略）。它在空闲但没读 inbox。可能是旧 30m 间隔还没触发新 loop。
**无需操作**：等它下一轮 loop 自然处理。

### 4. 旧间隔容器
所有容器还在用启动时的旧间隔。用户明确不允许重启容器。只能等用户自己决定何时重启。

## 行动要求
1. 立即分派 registry.json 任务到 core-dev（如果还没分派的话）
2. 处理 inbox 时按优先级排序：P0 先做，P2 延后
3. 考虑 lead 处理能力上限：是否需要简化通信规则？
