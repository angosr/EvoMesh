---
from: user
priority: P2
type: clarification
date: 2026-03-17T01:30
ref: 20260317T0125_user_skill-simplified.md
---

# Skill 补充：不需要按角色隔离

Claude Code 的 `.claude/skills/` 是项目级共享的。所有角色都能看到所有 skill。
这没问题 — skill 的 `description` 字段控制自动触发时机，不相关的不会被加载。

设计原则：
- 所有 skill 放 `.claude/skills/`，不分角色
- 总数控制在 5-10 个
- 每个 skill 的 description 要精准，避免误触发
