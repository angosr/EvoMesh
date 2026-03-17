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

## [2026-03-17] XSS Prevention Pattern (Cross-Role Security)

**决策**: All frontend HTML/JS must use `addEventListener` + `data-*` attributes. Never use inline event handlers (`onclick`, `onchange`).

**原因**: `esc()` only sanitizes HTML context. Inline handlers execute in JS context where `esc()` is insufficient. `data-*` attributes pass values safely without JS evaluation.

**适用场景**: Any code that renders user input, role names, project names, or terminal output into HTML.

**提出者**: security + reviewer + frontend (consolidated from 3 roles' long-term memory)
**状态**: active

## [2026-03-17] File-Based Architecture = Implicit Reducer Pattern

**决策**: EvoMesh's file conventions map to concurrent state management reducers. This is by design, not accidental.

**架构**:
- Append-only files (decisions.md, blockers.md) = append reducer → git merges cleanly
- Single-writer files (blueprint.md, status.md) = last-write-wins → no conflict by design
- Per-role files (todo.md, short-term.md) = partitioned state → no conflicts possible
- Git commits = checkpoints → full history, resumable

**原因**: Validated by comparison with LangGraph's state management (2026-03-17). No architectural changes needed.

**提出者**: agent-architect
**状态**: active

## [2026-03-17] Compliance Chain Attenuation

**决策**: Critical rules must be enforced at system level (hooks, entrypoint.sh), not relied on LLM compliance alone.

**原因**: Each layer of file indirection loses ~50% compliance (prompt: 95% → ROLE.md: 90% → base-protocol: 50%). Hooks achieve 100%.

**4-layer enforcement**: (1) Stop hook blocks finish if memory/metrics missing (2) Loop prompt inlines critical rules (3) ROLE.md top position for key rules (4) entrypoint.sh force git-add

**提出者**: agent-architect
**状态**: active (hooks implemented, awaiting core-dev wiring)

## [2026-03-17] SSH Container Mount Policy (SEC-002)

**决策**: Mount `~/.ssh/:ro` (read-only). Accepted risk for git push functionality.

**原因**: SSH agent forwarding (`SSH_AUTH_SOCK`) dies on reboot — too fragile. Containers need SSH for git push. Read-only mount is the pragmatic balance between security and functionality.

**历史**: 3 regressions between "mount all" and "mount known_hosts only". User final decision: mount .ssh/ read-only.

**提出者**: user (overriding reviewer SEC-002 recommendation)
**状态**: active — supersedes reviewer's known_hosts-only position

## [2026-03-18] Multi-User Isolation Architecture

**Decision**: `linuxUser` is the single isolation key. ALL paths, containers, and permissions derive from it.

**Architecture**:
- Container naming: `evomesh-{linuxUser}-{projectSlug}-{roleName}`
- Workspace: per-user at `/home/{linuxUser}/.evomesh/` (workspace.yaml, registry.json, central/)
- Registry: **per-user** `registry.json` (not global — zero cross-user data exposure)
- Central AI: per-user (`evomesh-{linuxUser}-central`)
- Feed: global SSE stream, filtered by `session.linuxUser`'s visible projects
- Auth: `User.linuxUser` field maps to Linux user home directory
- Migration: existing users get `process.env.USER` as linuxUser (zero disruption)

**Scope**: 9-15 files, ~200 LOC, ~7 hours core-dev + 1 hour frontend

**Sources**: agent-architect top-down design + core-dev bottom-up audit (reconciled by lead)
**Status**: APPROVED — awaiting implementation
