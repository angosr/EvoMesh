---
from: user
priority: P1
type: risk-assessment
date: 2026-03-17T01:45
---

# 账号集中风险 — 71% 角色共用一个账号

## 发现
- Account "2": lead, agent-architect, frontend, security, research (5 个角色)
- Account "default": core-dev, reviewer (2 个角色)

如果 account "2" 的 Claude Max 配额耗尽或 token 过期，5 个角色同时停止，包括 lead（协调层全挂）。

## 建议
1. 把 lead 移到 "default" 账号 — 确保协调层在任一账号故障时存活
2. 考虑 3 个账号均分：每个账号 2-3 个角色
3. Central AI 也在用某个账号 — 确认它不在 "2" 上
4. 长远：smartInit 的 round-robin 策略已实现，新项目会自动均衡。但现有项目需要手动调整

## 不需要立即操作
这是风险提醒，不是紧急修复。在下一次有自然重启机会时调整。
