# EvoMesh — 项目现况

> 本文件仅由 Lead 角色维护，其他角色只读。

## 当前进度

Phase 3 Web UI 快速迭代中。**密码认证已实现**（登录页、setup、修改密码、session token）。0.0.0.0 绑定恢复（远程服务器需求，有 auth 保护）。多用户系统（admin/viewer）已设计完成，待 executor 实现。reviewer 角色已移除。

## 角色状态

| 角色 | 状态 | 当前工作 |
|------|------|----------|
| lead | 运行中 | Loop #6 — 处理用户需求（token issue/admin UI/user mgmt），分派多用户任务 |
| executor | 运行中 | 待接收 P1 多用户管理系统任务 |
| reviewer | **已移除** | 用户决策 |

## 关键风险

| 优先级 | 问题 | 状态 |
|--------|------|------|
| ~~P0~~ | ~~Web UI 绑定 0.0.0.0~~ | ✅ 已解决 — auth 已实现，0.0.0.0 合理（远程服务器） |
| ~~P0~~ | ~~Web UI 无认证~~ | ✅ 已实现 — 密码认证 + 登录页 (94f739a) |
| P1 | 多用户管理系统 | 已设计，待 executor 实现 |
| P1 | 测试覆盖不足 | 进行中（4 文件） |
| ~~P0~~ | ~~spawner.ts 命令注入~~ | ✅ 已修复 (a71dede) |
| ~~P0~~ | ~~Web UI execSync 注入~~ | ✅ 已修复 (a71dede) |
| P1 | readYaml 无运行时校验 | 未开始 |
| P1 | expandHome fallback 错误 | 未开始 |
| P1 | 库函数调用 process.exit() | 未开始 |

## 待解决

- 多用户系统实现（已分派 executor）
- start background 模式需实际测试
- serve 命令应标记为 experimental
