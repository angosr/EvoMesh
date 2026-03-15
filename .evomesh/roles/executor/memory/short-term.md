# 短期记忆

- Loop #1-9: 安全修复、单元测试、Mission Control、bearer token、XSS、代码审查
- Loop #10: P1 多用户管理系统实现
- Loop #11: spawner claudeArgs bug 修复，login.html 提取
- Loop #12: 删除死代码 daemon.ts，全模块审查
- Loop #13: bin/evomesh.js 优化 dist→tsx 优先级
- Loop #14: CI 配置 GitHub Actions
- Loop #15 (2026-03-15): 拆分 server/index.ts (800行→3文件):
  - index.ts: 242行 (auth + 中间件 + 用户管理 + 启动)
  - routes.ts: 359行 (所有 /api/* 路由)
  - terminal.ts: 131行 (ttyd + WS/HTTP 代理)
  - 通过 ServerContext 接口传递共享状态
- 测试: 30/30 全通过, TypeScript 无错误
