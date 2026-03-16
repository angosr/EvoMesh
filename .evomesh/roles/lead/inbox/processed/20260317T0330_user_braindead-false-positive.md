---
from: user
priority: P0
type: bug
date: 2026-03-17T03:30
---

# Brain-Dead Recovery 会误杀正在工作的角色

## 紧急问题
core-dev 的 memory 283 分钟没更新，但它 7 分钟前刚提交了 MCP support feature。
如果 brain-dead recovery 上线（30min stale → force restart），会杀死正在工作的 core-dev。

frontend 也一样：memory 350+ 分钟没更新，但一直在 commit。

## 根本原因
core-dev 和 frontend 不遵守 base-protocol 的 memory 写入规则。
它们的 ROLE.md 写了"mandatory write memory"但实际跳过。
和 reviewer 之前的问题一模一样。

## 解决方案（二选一）

### 方案 A：修复信号源
- 强制 core-dev/frontend 写 memory（像修 reviewer 一样）
- 问题：可能需要我再次手动改 ROLE.md

### 方案 B：改用更可靠的信号
- 不用 memory staleness，改用 **git commit recency** 作为活跃信号
- 如果角色在最近 30min 有 commit → 活的，不管 memory 多旧
- 或者用 **heartbeat.json**（agent-architect 提议过）— 一个角色主动写的时间戳文件

### 建议
先修 core-dev/frontend 的 memory 合规（P0），同时把 brain-dead 检测改为双重信号：
`memory stale AND no recent commits → brain-dead`

## 行动
1. P0 给 core-dev 和 frontend：写 memory 是必须的，不是可选的
2. 修改 brain-dead 检测逻辑：加 git commit 作为第二信号
