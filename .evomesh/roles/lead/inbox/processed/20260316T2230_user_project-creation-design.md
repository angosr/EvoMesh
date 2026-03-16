---
from: user
priority: P1
type: heads-up
date: 2026-03-16T22:30
---

# 关注：Central AI 创建项目的完整流程设计

已给 agent-architect 发了 P0 任务，设计 Central AI 如何自主创建新项目：
- 项目脚手架模板（project.yaml 模板、目录结构）
- 角色模板库（lead/executor/reviewer 等可参数化模板）
- 项目分析流程（先分析代码再推荐角色）
- 账号分配策略

agent-architect 的方案会发给你审批。请关注并在审批时确保：
1. 最小角色集足够（lead + executor 就能启动）
2. 模板可复用不和 EvoMesh 项目耦合
3. Central AI 的 ROLE.md 更新后能自闭环
