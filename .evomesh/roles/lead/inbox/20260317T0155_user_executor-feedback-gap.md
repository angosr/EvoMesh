---
from: user
priority: P1
type: design-issue
date: 2026-03-17T01:55
---

# 执行角色不向 lead 报告完成 — 反馈环断裂

## 发现
分析 inbox 通信记录：
- agent-architect → lead: 11 条消息（提案、报告、完成通知）
- research → lead: 5 条消息
- **core-dev → lead: 0 条消息**
- **frontend → lead: 0 条消息**

core-dev 和 frontend 是纯执行者 — 只接收任务，从不回报。你靠 git log 推测完成状态。

## 影响
- 你不确定 smartInit 迁移是否真的按设计完成
- 你不确定 mission-control API 是否满足需求
- 你无法区分"正在做"、"做完了"、"做不了"

## 建议
1. 在 base-protocol 里加入规则：收到 P0/P1 任务后，完成时必须回复 `type: ack, status: done` 到发送者 inbox
2. 或者修改 core-dev 和 frontend 的 ROLE.md：loop flow 加一步 "report completion to lead for any P0/P1 task"
3. 不需要对 P2 回复 — 太频繁会加重你的 inbox 负担
