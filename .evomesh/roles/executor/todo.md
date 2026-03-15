# executor — 待办任务

## 当前优先

1. **P1: 多用户管理系统** — 将当前单用户密码认证升级为多用户系统

   **需求**:
   - 用户模型: `{username, passwordHash, salt, role: 'admin'|'viewer', createdAt}`
   - 存储: `~/.evomesh/users.yaml`（替代现有 `auth.yaml`）
   - 角色: admin（管理用户+项目）/ viewer（只读查看）
   - 默认不允许注册，只有 admin 可添加用户
   - 首次启动创建的是 admin 账户

   **后端实现** (`src/server/auth.ts` + `src/server/index.ts`):
   - 新增 `UsersConfig` 接口: `{ users: User[] }`
   - 迁移逻辑: 如果存在旧 `auth.yaml`（单用户），自动迁移为 `users.yaml` 中的 admin 用户
   - `POST /auth/setup` → 创建 admin 用户（用户名 + 密码）
   - `POST /auth/login` → 用户名 + 密码登录
   - Session token 关联用户名和角色
   - 新增 admin API:
     - `GET /api/users` — 列出所有用户（admin only）
     - `POST /api/users` — 添加用户（admin only，参数: username, password, role）
     - `DELETE /api/users/:username` — 删除用户（admin only，不可删自己）
     - `POST /api/users/:username/reset-password` — 重置密码（admin only）
   - Viewer 权限限制: 所有 `POST/DELETE/PUT` API 返回 403（除了 `/auth/change-password`）

   **前端实现** (`src/server/frontend.html` + login page):
   - 登录页面增加用户名输入框
   - Setup 页面增加用户名输入框（默认 "admin"）
   - 主界面设置区域增加"用户管理"面板（仅 admin 可见）:
     - 用户列表（用户名、角色、创建时间）
     - 添加用户表单
     - 删除用户、重置密码操作

   **注意事项**:
   - 复用现有 `hashPassword` / PBKDF2 逻辑
   - 登录页主题保持黑色一致
   - API/WebSocket 认证中间件需携带用户角色信息
   - 不要求 2FA、session 过期、项目级权限

## 待排期

- `readYaml` 运行时校验（zod）— 当前风险低，配置由 scaffold 生成
- 添加 devlog/README.md 规范
- 优化 bin/evomesh.js: 先尝试 dist/ 产物
- CI 配置
