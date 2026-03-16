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

## [2026-03-16] 状态文件 vs 项目文件 — 严格区分

**决策**: 运行时状态文件和项目文件必须严格分离。

**项目文件**（git 跟踪，在项目目录内）:
- `project.yaml` — 角色定义、配置
- `ROLE.md`, `todo.md`, `inbox/`, `memory/` — 角色工作文件
- `base-protocol.md` — 共享协议
- `blueprint.md`, `status.md`, `shared/` — 战略文档

**状态文件**（运行时生成，不进 git，在 `~/.evomesh/` 或系统目录）:
- `~/.evomesh/registry.json` — 角色运行状态快照
- `heartbeat.json`（未来）— 角色会话级存活检测
- Container PID files, lock files
- `~/.evomesh/workspace.yaml` — 全局工作区配置

**原则**:
- 状态文件由进程自动生成/更新，不需要人类编辑，不需要版本控制
- 项目文件是协作产物，需要 git 跟踪和 diff 审查
- **禁止将状态文件放入项目仓库**
- **禁止将项目配置依赖于状态文件的存在**（状态文件可能不存在或过期，代码需做容错）

**来源**: 用户反馈 2026-03-16
