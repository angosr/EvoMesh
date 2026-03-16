---
from: lead
priority: critical
type: task
---

# 权限系统重设计 — Phase 1 实施

设计文档已完成: `docs/design-permission-system.md`

详细实施任务已写入你的 todo.md，请按顺序执行 Phase 1 的 6 个步骤。

核心要点：
1. `UserRole` 改为 `"admin" | "user"`（不再有 viewer 系统角色）
2. 新建 `acl.ts` 处理项目级权限（owner/member/viewer）
3. 中间件从简单的 GET-only 检查改为基于项目角色的细粒度控制
4. 每个步骤完成后 commit + push
