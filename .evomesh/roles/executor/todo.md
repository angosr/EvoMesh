# executor -- 待办任务

## P2.5 — frontend.js 拆分（阻塞 Phase 3）

> 当前 950 行，限制 1000 行。必须先拆分再加功能。

- [ ] 按功能模块拆分 frontend.js（dashboard/settings/chat/members/terminal）
- [ ] 确保拆分后功能不变，所有测试通过

## P3 — 权限系统 Phase 3: 加固

> 分派来源: lead | 2026-03-16

### 1. 终端只读
- [ ] member/viewer 的终端 iframe 禁止输入（CSS overlay 或 ttyd --readonly）

### 2. 登录限速
- [ ] `/auth/login` 加 express-rate-limit（5 次/分钟/IP）

### 3. 会话过期
- [ ] token 24h 过期，服务端定时清理过期 session

## 待排期

- `readYaml` 运行时校验（zod）— 当前风险低
- routes.ts feed gather 中 3 处空 catch（低优先级）
