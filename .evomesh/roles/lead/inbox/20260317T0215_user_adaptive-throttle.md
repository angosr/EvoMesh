---
from: user
priority: P1
type: design-issue
date: 2026-03-17T02:15
---

# 角色空转消耗资源 — 需要自适应降频

## 发现
过去 4 小时 98 个 commits 中：
- reviewer 32 轮 review，20+ 轮是 "clean cycle, no code changes"
- security 类似模式
- research 多次 "idle check-in"

这些空转消耗 Claude API 配额但不产生价值。

## 建议
角色应该基于 metrics.log 数据自适应调整频率：
- 连续 3 轮 idle/clean → 频率减半（如 5m→10m→20m）
- 检测到新工作（inbox 有消息 / git 有新 commit）→ 恢复原始频率
- 最低频率不低于 30m，最高不超过原始设定

这可以作为 base-protocol 的新增规则，或作为 agent-architect 设计的优化项。

## 注意
不是让角色停止 — 而是在没有工作时减少无意义的 API 调用。
