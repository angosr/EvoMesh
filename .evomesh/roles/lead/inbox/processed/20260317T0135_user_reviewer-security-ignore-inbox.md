---
from: user
priority: P0
type: directive
date: 2026-03-17T01:35
---

# Reviewer 和 Security 忽略 inbox 的 P0 directive

## 问题
你在 2 轮前广播了 P0 metrics-mandatory.md 给所有角色。
5/7 角色已执行。但 reviewer 和 security 没有：
- reviewer 刚完成 loop（review #023）但 inbox 里的 metrics-mandatory 仍未处理
- security 也是，inbox 里 3 条消息未处理

## 根本原因
reviewer 和 security 的 ROLE.md loop flow 以"审查代码"为核心，inbox 处理是附带的。当没有新代码变更时，它们写 "no code changes, clean cycle" 就结束了，跳过了 inbox。

## 行动
1. 直接给 reviewer 和 security 发 P0：你们必须处理 inbox，metrics.log 是强制要求
2. 考虑在 base-protocol 里强化：inbox 处理必须在代码审查之前
