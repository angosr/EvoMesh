---
from: lead
priority: medium
type: task
---

# 拆分 server/index.ts

`src/server/index.ts` 当前 800 行，接近 1000 行上限（开发协议 2.1 规定）。

## 建议拆分方案

将路由、WebSocket 代理逻辑提取为独立模块：
- `server/routes.ts` — 所有 `/api/*` 路由
- `server/ws-proxy.ts` — WebSocket 终端代理逻辑
- `server/index.ts` — 保留服务器初始化、中间件、静态文件

## 要求
- 功能不变，纯重构
- 拆分后所有测试通过
- 每个文件不超过 400 行
