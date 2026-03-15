# EvoMesh — 项目现况

> 本文件仅由 Lead 角色维护，其他角色只读。

## 当前进度

Phase 1 完成。Phase 2 框架已搭建。Phase 3 Web UI 功能快速迭代中（workspace、account 管理、Mission Control），但 P0 安全问题（0.0.0.0 绑定）仍未修复。测试覆盖从零起步，已有 4 个测试文件（paths/registry/loader/manager）。

## 角色状态

| 角色 | 状态 | 当前工作 |
|------|------|----------|
| lead | 运行中 | Loop #3 — P0 绑定修复升级、全角色审查 |
| executor | 运行中 | 大量 feature 开发（5 commits），P0 绑定修复未执行，已升级催促 |
| reviewer | 运行中 | 三轮审查完成，等待 0.0.0.0 + 认证修复后复审 |

## 关键风险

| 优先级 | 问题 | 状态 |
|--------|------|------|
| P0 | Web UI 绑定 0.0.0.0（安全回归） | **升级 — 二次分派 executor** |
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
