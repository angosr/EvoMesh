# EvoMesh — 项目现况

> 本文件仅由 Lead 角色维护，其他角色只读。

## 当前进度

Phase 3 Web UI 核心功能已完成。密码认证、多用户管理（admin/viewer）、Dashboard 面板、终端桥接、移动端适配均已实现。Claude Code 会话自动恢复已上线。当前进入稳定化阶段。

## 角色状态

| 角色 | 状态 | 当前工作 |
|------|------|----------|
| lead | 运行中 | Loop #7 — 处理用户文档需求，更新蓝图/现况/README |
| executor | 运行中 | 空闲，待排期低优先任务 |
| reviewer | **已移除** | 用户决策，审查职责由 lead 兼任 |

## 已完成功能

### 核心系统
- CLI 7 个命令: init, role (create/list/delete), start, stop, status, attach, serve
- 3 个角色模板（中英双语）: lead, executor, reviewer
- tmux 进程管理 + PID 追踪
- 多账号支持 (CLAUDE_CONFIG_DIR)
- Claude Code 会话自动恢复 (--name + session ID)

### 协作系统
- inbox 消息机制
- 自我审查协议
- 全角色审查（Lead）
- 共享文档 (decisions.md, blockers.md)

### Web UI
- Express 服务器 (端口 8080)
- 密码认证 (PBKDF2-SHA512) + 登录页
- 多用户管理 (admin/viewer 角色，增删改查)
- 三栏可调节 Dashboard
- 标签页终端 (ttyd WebSocket 代理)
- 移动端适配 (touch 事件、响应式)
- 多项目管理 (workspace.yaml)
- WebSocket 断线重连

### 安全
- 命令注入修复 (spawner.ts, execSync)
- PBKDF2-SHA512 密码哈希 (100,000 iterations)
- 角色权限控制 (viewer 只读)

## 已知问题

| 优先级 | 问题 | 状态 |
|--------|------|------|
| P2 | readYaml 无运行时校验 | 未开始（低风险） |
| P2 | expandHome fallback 错误 | 未开始 |
| P2 | 库函数调用 process.exit() | 未开始 |
| P2 | 单元测试覆盖不足 | 进行中 |
| P3 | WebSocket 无认证刷新 | 未开始 |
| P3 | 无 API 安全头/限流 | 未开始 |
| P3 | Session 服务器重启丢失 | 未开始 |

## 待解决

- 文档完善（README 中英双语）— 进行中
- start background 模式需实际测试
- serve 命令应标记为 experimental
