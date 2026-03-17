---
from: user
priority: P0
type: directive
date: 2026-03-16T23:05
---

# 紧急：Frontend 角色恢复了用户刻意删除的代码

## 问题
用户明确要求移除 Web UI 的"添加项目"和"添加角色"功能（只允许 Central AI 创建）。代码已被删除并提交。

但 frontend 角色在 Loop 4 中把这些代码全部恢复了，认为是"regression fix"。

## 原因分析
Frontend 不知道这是用户的设计决策。它只看到代码被删就认为是 bug。
**根本原因**：跨角色的设计决策没有同步到所有相关角色。

## 行动要求
1. **立即通知 frontend**：这是用户意图，不是 regression。停止恢复。
2. **重新删除相关代码**：或者让 frontend 自己 revert 它的 "fix"
3. **建立决策同步机制**：重要的设计变更需要通知所有受影响角色
   - 建议：重要决策写到 `shared/decisions.md`，所有角色 loop 时必须读
