# executor -- 待办任务

## P0 — 权限系统重设计实施

> 设计文档: `docs/design-permission-system.md`
> 分派来源: lead | 2026-03-16

按 Phase 1 顺序实施：

### 1. auth.ts — 角色类型改造 ✅
- [x] `UserRole` 从 `"admin" | "viewer"` 改为 `"admin" | "user"`
- [x] `SessionInfo.role` 跟随变更
- [x] 添加迁移逻辑: 现有 `viewer` 用户自动升级为 `user`
- [x] 更新 `addUser()` 默认角色为 `"user"`

### 2. 新建 acl.ts — 项目级访问控制 ✅
- [x] `ProjectRole = "owner" | "member" | "viewer"`
- [x] `loadAcl()` / `saveAcl()` — 读写 `~/.evomesh/acl.yaml`
- [x] `getProjectRole(username, systemRole, projectPath): ProjectRole | null`
- [x] `setProjectOwner(projectPath, username)`
- [x] `grantAccess(projectPath, targetUser, role: "member" | "viewer")`
- [x] `revokeAccess(projectPath, targetUser)`
- [x] `listMembers(projectPath)`
- [x] `removeProject(projectPath)` — 清理 ACL 条目
- [x] `hasMinProjectRole()` — 角色层级检查
- [x] `getAccessibleProjects()` — 按用户过滤项目
- [x] 24 test cases

### 3. index.ts — 中间件改造
- [ ] 替换 `session.role === "viewer" && req.method !== "GET"` 为新授权逻辑
- [ ] `requireAdmin(req, res)` 保留不变
- [ ] 新增 `requireProjectRole(req, res, minRole)` 辅助函数
- [ ] 用户管理 API 保持 admin-only

### 4. routes.ts — 端点权限适配
- [ ] `GET /api/projects` — 按用户权限过滤可见项目
- [ ] `POST /api/projects/add` — admin 或 user, 自动设为 owner
- [ ] `DELETE /api/projects/:slug` — admin 或 owner
- [ ] 角色操作 (start/stop/restart/create/delete/config/account) — admin 或 owner
- [ ] `POST /api/projects/:slug/chat` — admin 或 owner 或 member
- [ ] 查看类 (status/log/feed) — 有任意项目角色即可

### 5. 新增成员管理端点
- [ ] `GET /api/projects/:slug/members`
- [ ] `POST /api/projects/:slug/members` — { username, role }
- [ ] `DELETE /api/projects/:slug/members/:username`

### 6. 迁移
- [ ] 首次加载时: 如无 acl.yaml, 自动创建, 现有项目 owner 设为第一个 admin 用户

### 实施原则
- 参考设计文档中的权限矩阵，确保无遗漏
- 每完成一个子任务就 commit + push
- auth.test.ts 需同步更新
- 新建 test/server/acl.test.ts

## P1 — 代码工程化整理

> 分派来源: lead | 2026-03-16

### 1. 消除 slugify 重复（Critical）
- [ ] 统一使用 `src/workspace/config.ts` 中的 `slugify()`
- [ ] 删除 `src/process/container.ts:26` 的本地 slugify
- [ ] 替换 `src/process/spawner.ts` 中 4 处内联 slugify
- [ ] 替换 `src/server/routes.ts:445` 的内联 slugify

### 2. 提取端口分配辅助函数
- [ ] 创建 `allocatePort(basePort, ttydProcesses)` 函数
- [ ] 替换 routes.ts 中 4 处重复的端口分配逻辑（lines 75, 138, 171, 244）

### 3. 统一响应格式
- [ ] 将 routes.ts 中 `.send("Invalid")` 统一为 `.json({ error: "Invalid" })`

### 4. 判断 spawner.ts 是否仍需要
- [ ] 检查 CLI commands (start.ts, stop.ts, attach.ts) 是否还使用 spawner.ts
- [ ] 如已完全迁移到 container.ts，删除 spawner.ts 中的废弃代码

## 待排期

- `readYaml` 运行时校验（zod）— 当前风险低，配置由 scaffold 生成
- frontend.js 892 行，接近 1000 行阈值，关注拆分
- routes.ts 463 行，考虑按功能拆分为多个路由文件
- routes.ts feed gather 中 3 处空 catch（低优先级）
