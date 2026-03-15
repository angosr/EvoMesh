# EvoMesh — 战略蓝图

> 本文件仅由 Lead 角色维护，其他角色只读。

## 项目愿景

基于 Claude Code 的多角色自演进开发框架。不构建新 Agent，复用 Claude Code 原生能力，提供结构化角色模板、自演进协议和 Web 操作界面。

## 技术路线

### Phase 1 — CLI + 模板 (MVP) ✅
- [x] CLI: init / role create|list|delete / start|stop|status|attach / serve
- [x] 3 个内置模板: lead, executor, reviewer（中英双语）
- [x] 进程管理: tmux + node-pty spawn + PID registry
- [x] 多账号支持 (CLAUDE_CONFIG_DIR)
- [x] 自举

### Phase 2 — 协作 + 演进 ✅
- [x] inbox 消息机制
- [x] 自我审查协议实现（角色 ROLE.md 中定义）
- [x] Lead 全角色审查
- [x] devlog 规范
- [x] 安全加固: P0 命令注入修复
- [ ] 运行时配置校验 (zod) — 低优先，配置由 scaffold 生成
- [ ] 单元测试补全

### Phase 3 — Web UI ✅
- [x] 终端桥接 (ttyd + WebSocket) — 含 scrollback、touch 支持
- [x] 密码认证 + 登录页 + session 管理
- [x] 多用户管理系统（admin/viewer 角色，用户增删改查）
- [x] Dashboard 面板布局（可调节三栏、标签页终端、角色状态）
- [x] 移动端适配（touch 事件、响应式布局）
- [x] 多项目管理（workspace.yaml）
- [x] Claude Code 会话自动恢复（--name + session ID）
- [x] CI: GitHub Actions (tsc + test)

### Phase 4 — 打磨 ← 当前
- [x] server/index.ts 拆分重构（800 行 → index 242 + routes 359 + terminal 131）
- [x] frontend.html 拆分（1167 行 → html 181 + css 294 + js 670）
- [x] Settings 面板（替换 prompt() 弹窗为正式界面）
- [x] 移动端 tmux 触摸滚动
- [ ] WebSocket 认证刷新
- [ ] API 安全头 / 限流
- [ ] Session 持久化（当前服务器重启丢失）
- [ ] 模板导入/导出
- [ ] 演进可视化
- [ ] 审计日志

## 架构决策

1. 单包结构，TypeScript + Express + tmux
2. 兼容 Claude Code 原生 .claude/ 结构
3. 所有角色同分支同目录
4. tmux 进程管理，foreground + background 模式
5. 认证: PBKDF2-SHA512 + 内存 session，用户数据存 ~/.evomesh/users.yaml
6. Web UI: HTML + CSS + JS 分离，Express 内联 serve（无前端构建依赖）
