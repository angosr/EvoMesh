# EvoMesh — 项目现况

> 本文件仅由 Lead 角色维护，其他角色只读。

## 当前进度

Phase 1 完成。Phase 2 框架已搭建。Phase 3 Web UI 功能快速迭代中（workspace、account 管理、Mission Control、metrics、auto-reconnect）。P0 绑定回归已由 lead 直接修复。认证仍缺失。测试覆盖已起步（4 文件）。reviewer 角色已被用户移除。

## 角色状态

| 角色 | 状态 | 当前工作 |
|------|------|----------|
| lead | 运行中 | Loop #5 — 第三次修复 P0 绑定（executor 恢复了漏洞）、发安全指令 |
| executor | 运行中 | 高产 feature 开发，但恢复了 lead 的安全修复（92721dc），inbox 已处理 |
| reviewer | **已移除** | 用户决策 |

## 关键风险

| 优先级 | 问题 | 状态 |
|--------|------|------|
| P0 | Web UI 绑定 0.0.0.0 | **Executor 恢复了漏洞 (92721dc)，Lead 第三次修复，已发 directive** |
| P0 | Web UI 无认证 | 待排期 |
| P0→P1 | 测试覆盖不足 | 进行中（4 文件，核心模块已覆盖） |
| ~~P0~~ | ~~spawner.ts 命令注入~~ | ✅ 已修复 (a71dede) |
| ~~P0~~ | ~~Web UI execSync 注入~~ | ✅ 已修复 (a71dede) |
| ~~P0~~ | ~~spawner.ts pipe-pane logPath~~ | ✅ 已修复 (a71dede) |
| P1 | readYaml 无运行时校验 | 未开始 |
| P1 | expandHome fallback 错误 | 未开始 |
| P1 | 库函数调用 process.exit() | 未开始 |

## 待解决

- start background 模式需实际测试
- Web UI 需要 token 认证才能上线
- serve 命令应标记为 experimental
