# 技术决策记录

## [2026-03-15] server.listen 必须绑定 0.0.0.0

**决策**: `src/server/index.ts` 的 `server.listen` 必须使用 `0.0.0.0`，禁止改为 `127.0.0.1`。

**原因**: 服务器部署在远程机器（AWS EC2），用户通过公网 IP 访问 Web UI。绑定 `127.0.0.1` 会导致外网无法访问。

**安全措施**: 通过 bearer token 认证保护（已实现），而非限制绑定地址。

**所有角色注意**: 这不是安全漏洞，请勿作为"安全修复"反复修改此行。

## [2026-03-16] 注册表闭环架构 (Registry Closed-Loop)

**决策**: 采用闭环设计，信息来源唯一化。

**架构**:
- **配置文件 = 唯一信息源** (what SHOULD exist): `workspace.yaml` + `project.yaml`
- **registry.json = 运行时快照** (what IS running): Server 每 15 秒写入 `~/.evomesh/registry.json`
- **唯一写入者: Server**。Central AI、所有角色只读

**规则**:
- Central AI **禁止**写 registry.json、调用 HTTP API、使用 docker 命令
- Web UI **禁止**直接修改 config 文件（必须通过 Server API）
- 所有对项目/角色的增删改，最终都是修改 workspace.yaml / project.yaml

**来源**: 用户 P0 指令 `20260316T2205_user_registry-closed-loop.md`（supersedes `20260316T2201`）

## [2026-03-16] Mission Control 右侧面板

**决策**: 右侧面板重新设计为 Mission Control，由 Server 直接聚合数据，不依赖 Central AI。

**组件**:
1. 实时活动流 — Server 读取角色 `memory/short-term.md`，diff 检测变化
2. 问题/告警 — 自动检测停止运行、P0 未处理、长时间无输出
3. 任务总览 — 聚合所有 `todo.md`，按优先级排列
4. 指令区 — 保留输入框发送到 Central AI inbox

**技术**: 新增 `/api/mission-control` API，前端 5 秒轮询或 SSE

**来源**: 用户 P0 指令 `20260316T2200_user_mission-control-panel.md`
