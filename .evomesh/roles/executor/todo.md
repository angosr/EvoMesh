# executor -- 待办任务

## P0 — 权限系统重设计实施 ✅ Phase 1 完成

> 设计文档: `docs/design-permission-system.md`
> 分派来源: lead | 2026-03-16

### 1. auth.ts — 角色类型改造 ✅
### 2. 新建 acl.ts — 项目级访问控制 ✅ (24 tests)
### 3. index.ts — 中间件改造 ✅
### 4. routes.ts — 端点权限适配 ✅
### 5. 新增成员管理端点 ✅ (GET/POST/DELETE /api/projects/:slug/members)
### 6. 迁移 ✅ (ensureAclMigration on startup)

> Phase 2 (UI) 和 Phase 3 (Hardening) 待 lead 确认排期

## P1 — 代码工程化整理

> 分派来源: lead | 2026-03-16

### 1. 消除 slugify 重复（Critical）
- [ ] 统一使用 `src/workspace/config.ts` 中的 `slugify()`
- [ ] 删除 `src/process/container.ts:26` 的本地 slugify
- [ ] 替换 `src/process/spawner.ts` 中 4 处内联 slugify
- [ ] 替换 `src/server/routes.ts:445` 的内联 slugify

### 2. 提取端口分配辅助函数
- [ ] 创建 `allocatePort(basePort, ttydProcesses)` 函数
- [ ] 替换 routes.ts 中 4 处重复的端口分配逻辑

### 3. 统一响应格式
- [ ] 将 routes.ts 中 `.send("Invalid")` 统一为 `.json({ error: "Invalid" })`

### 4. 判断 spawner.ts 是否仍需要
- [ ] 检查 CLI commands 是否还使用 spawner.ts
- [ ] 如已完全迁移到 container.ts，删除废弃代码

## 待排期

- `readYaml` 运行时校验（zod）— 当前风险低
- frontend.js 892 行，接近 1000 行阈值
- routes.ts feed gather 中 3 处空 catch（低优先级）
