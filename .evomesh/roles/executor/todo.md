# executor -- 待办任务

## P2 — 权限系统 Phase 2: UI 权限过滤

> 分派来源: lead | 2026-03-16

### 1. API: 返回用户项目角色 ✅
### 2. Frontend: 按权限显隐 UI ✅

### 3. 项目成员管理面板
- [ ] owned 项目在 dashboard 中显示 "Members" 管理入口
- [ ] 成员列表 + 添加/删除成员 UI
- [ ] 调用 `/api/projects/:slug/members` 端点

## 待排期

- 权限系统 Phase 3（终端只读、限速、会话过期）
- `readYaml` 运行时校验（zod）— 当前风险低
- frontend.js 892 行，接近 1000 行阈值
- routes.ts feed gather 中 3 处空 catch（低优先级）
