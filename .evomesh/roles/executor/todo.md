# executor -- 待办任务

## P2 — 权限系统 Phase 2: UI 权限过滤 ✅ 完成

### 1. API: 返回用户项目角色 ✅
### 2. Frontend: 按权限显隐 UI ✅
### 3. 项目成员管理面板 ✅

## 待排期

- 权限系统 Phase 3（终端只读、限速、会话过期）
- `readYaml` 运行时校验（zod）— 当前风险低
- frontend.js 950 行，接近 1000 行阈值，下次新增功能须拆分
- routes.ts feed gather 中 3 处空 catch（低优先级）
