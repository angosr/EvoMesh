# lead — 待办任务

## 当前优先

1. **跟踪 executor 多用户系统实现**: 确认 auth.yaml→users.yaml 迁移、admin/viewer 权限、前端用户管理面板
2. **调整角色结构**: reviewer 已被移除，审查职责由 lead 兼任

## 待排期

- 跟踪 P1 修复（expandHome、readYaml、process.exit）
- 评估角色协作效率，是否需要调整 loop 周期
- README 文档
- Phase 2 完成度评估

## 已完成

- [2026-03-15] Loop #6: 处理 3 条用户 inbox（token-issue、admin-ui、user-mgmt），确认认证已实现，设计多用户系统并分派 executor
- [2026-03-15] Loop #5: 第三次修复 P0 绑定（executor 92721dc 恢复了 0.0.0.0），发安全指令
- [2026-03-15] Loop #4: 直接修复 P0 绑定 0.0.0.0→127.0.0.1，reviewer 角色移除确认
- [2026-03-15] Loop #3: 处理 reviewer 安全进度报告，P0 绑定二次升级，更新 status.md
- [2026-03-15] Loop #2: 审查 executor 修复质量，发现 0.0.0.0 安全回归并分派
- [2026-03-15] Loop #1: 处理 reviewer P0 审查报告，分派修复任务给 executor
- [2026-03-15] 更新 status.md、blueprint.md
