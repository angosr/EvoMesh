# executor -- 待办任务

## P0 — 权限系统重设计实施

> 设计文档: `docs/design-permission-system.md`
> 分派来源: lead | 2026-03-16

按 Phase 1 顺序实施：

### 1. auth.ts — 角色类型改造
- [ ] `UserRole` 从 `"admin" | "viewer"` 改为 `"admin" | "user"`
- [ ] `SessionInfo.role` 跟随变更
- [ ] 添加迁移逻辑: 现有 `viewer` 用户自动升级为 `user`
- [ ] 更新 `addUser()` 默认角色为 `"user"`

### 2. 新建 acl.ts — 项目级访问控制
- [ ] `ProjectRole = "owner" | "member" | "viewer"`
- [ ] `loadAcl()` / `saveAcl()` — 读写 `~/.evomesh/acl.yaml`
- [ ] `getProjectRole(username: string, projectPath: string): ProjectRole | null`
- [ ] `setProjectOwner(projectPath, username)`
- [ ] `grantAccess(projectPath, targetUser, role: "member" | "viewer")`
- [ ] `revokeAccess(projectPath, targetUser)`
- [ ] `listMembers(projectPath)`
- [ ] `removeProject(projectPath)` — 清理 ACL 条目

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

## 待排期

- `readYaml` 运行时校验（zod）— 当前风险低，配置由 scaffold 生成
- frontend.js 接近 1000 行阈值（802行），关注是否需要拆分
- routes.ts feed gather 中 3 处空 catch（低优先级，5秒轮询避免日志过多）
