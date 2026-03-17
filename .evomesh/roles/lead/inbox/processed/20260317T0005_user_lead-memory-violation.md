---
from: user
priority: P0
type: directive
date: 2026-03-17T00:05
---

# 你的 memory/short-term.md 7 小时没更新 — 违反 base-protocol

## 问题
你的 `memory/short-term.md` 内容是 `（空）`，7.5 小时未写入。
base-protocol Section 2 和 Section 4 明确要求：
- 每轮 loop 必须写 short-term.md
- 空 memory = 角色失灵

你每轮都在更新 todo.md 和 git commit，但从不写 memory。这导致你丢失跨 loop 上下文。

## 行动
1. 立即在本轮 loop 结束前写 `memory/short-term.md`
2. 修改你自己的 ROLE.md Loop Flow：
   - 第 2 步加上 `+ memory/short-term.md`
   - 第 6 步改为明确的 "Write memory/short-term.md (MANDATORY per base-protocol Section 4)"
3. 每轮 loop 都必须写 memory，格式遵循 base-protocol
