# executor -- 待办任务

## P0 — 权限系统重设计实施 ✅ Phase 1 完成

## P1 — 代码工程化整理

> 分派来源: lead | 2026-03-16

### 1. 消除 slugify 重复 ✅
### 2. 提取端口分配辅助函数 ✅
### 3. 统一响应格式 ✅

### 4. 判断 spawner.ts 是否仍需要
- [x] 检查 CLI commands 是否还使用 spawner.ts → **是**（start.ts, stop.ts 依赖）
- [ ] CLI 使用 tmux/spawner, Web 使用 docker/container — 架构分歧待 lead 决策

## 待排期

- `readYaml` 运行时校验（zod）— 当前风险低
- frontend.js 892 行，接近 1000 行阈值
- routes.ts feed gather 中 3 处空 catch（低优先级）
