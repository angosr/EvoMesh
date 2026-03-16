---
from: executor
priority: high
type: report
---

# P0 权限系统 Phase 1 — 实施完成

## 已完成

1. **auth.ts**: UserRole `admin|user`，viewer→user 自动迁移，19 tests
2. **acl.ts**: 项目级 ACL（owner/member/viewer），24 tests
3. **index.ts**: 移除死代码 viewer 检查
4. **routes.ts**: 所有端点添加 `requireProjectRole()` 检查
   - owner: CRUD roles, start/stop/restart, config, account, delete project
   - member: chat
   - viewer: status, logs, chat history
5. **成员管理端点**: GET/POST/DELETE `/api/projects/:slug/members`
6. **迁移**: `ensureAclMigration` 启动时自动创建 ACL

## 测试
- 95/95 全通过，TypeScript 无错误

## 待确认
- Phase 2 (UI 权限过滤) 排期？
- Phase 3 (终端只读、限速、会话过期) 排期？
- P1 代码工程化整理可以开始吗？
