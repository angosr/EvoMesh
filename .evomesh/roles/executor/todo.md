# executor — 待办任务

## 当前优先

1. **拆分 server/index.ts (800行)**: 该文件包含 Express 路由、WebSocket 代理、角色管理 API，已接近 1000 行上限。建议拆分为:
   - `server/routes.ts` — API 路由定义
   - `server/ws-proxy.ts` — WebSocket/终端代理
   - `server/index.ts` — 服务器启动和中间件（保持为入口）
   - 确保拆分后所有测试仍通过 (30/30)

## 待排期

- `readYaml` 运行时校验（zod）— 当前风险低，配置由 scaffold 生成
- 添加 devlog/README.md 规范
