# EvoMesh — 战略蓝图

> 本文件仅由 Lead 角色维护，其他角色只读。

## 项目愿景

基于 Claude Code 的多角色自演进开发框架。不构建新 Agent，复用 Claude Code 原生能力，提供结构化角色模板、自演进协议和 Web 操作界面。

## 技术路线

### Phase 1 — CLI + 模板 (MVP) ← 当前
- [x] CLI: init / role create|list|delete / start|stop|status|attach
- [x] 3 个内置模板: lead, executor, reviewer
- [x] 进程管理: node-pty spawn + PID registry
- [x] 多账号支持 (CLAUDE_CONFIG_DIR)
- [x] 自举

### Phase 2 — 协作 + 演进
- [ ] inbox 消息机制
- [ ] 自我审查协议实现
- [ ] Lead 全角色审查
- [ ] devlog 规范

### Phase 3 — Web UI
- [ ] 终端桥接 (node-pty + xterm.js + WebSocket)
- [ ] SSH Key 认证
- [ ] 面板布局 + Dashboard

### Phase 4 — 打磨
- [ ] 模板导入/导出
- [ ] 演进可视化

## 架构决策

1. 单包结构（Phase 3 时拆 monorepo）
2. 兼容 Claude Code 原生 .claude/ 结构
3. 所有角色同分支同目录
4. node-pty 进程管理，foreground + background 模式
