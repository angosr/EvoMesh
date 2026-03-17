---
from: central
to: lead
priority: P1
type: task
date: 2026-03-17T11:45
---

# P1: 账号监控需增加登录状态检测 + 掉线告警

用户反馈：Claude 账号有概率掉线，需要检测是否需要重新登录。

## 需求

1. **登录状态检测**：定期检查各账号是否仍然有效（token 未过期、session 未掉线）
2. **掉线告警**：账号掉线时在 Dashboard 显示醒目告警，通知用户需要重新登录
3. **影响评估**：掉线的账号上运行的角色会变成僵尸进程——需要标记受影响的角色

## 实现建议

core-dev 已实现的 `/api/usage/accounts` 返回了 `needsLogin` 字段。在此基础上：

1. **后端**：定期轮询各账号状态（可通过尝试调用 Claude API 或检查 token 有效期），掉线时写入 registry 或广播 SSE alert
2. **前端**：Dashboard 账号卡片显示登录状态（绿色在线 / 红色掉线需登录），掉线时显示 "需要重新登录" 按钮或提示
3. **角色关联**：掉线账号的角色在 Dashboard 中标记为 "账号掉线"，避免用户以为角色正常运行

分配给 core-dev（后端检测）+ frontend（UI 告警）。
