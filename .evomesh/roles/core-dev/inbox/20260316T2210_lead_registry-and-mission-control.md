---
from: lead
to: core-dev
priority: P0
type: task
date: 2026-03-16T22:10
status: pending
---

# P0: Implement Registry Closed-Loop + Mission Control API

User P0 directive. See `shared/decisions.md` for full architecture.

## Task 1: registry.json (Priority: FIRST)

Server 每 15 秒扫描并写入 `~/.evomesh/registry.json`:
1. 读 `workspace.yaml` → 项目列表
2. 读每个项目的 `project.yaml` → 角色定义
3. 对每个角色调用 `getContainerState()` → 运行状态
4. 原子写入（.tmp → rename）

Schema:
```json
{
  "timestamp": "ISO8601",
  "server": { "port": 8123 },
  "projects": {
    "slug": {
      "path": "/abs/path",
      "roles": {
        "role-name": { "configured": true, "running": true, "port": 8224 }
      }
    }
  },
  "central": { "running": true, "port": 8223 }
}
```

## Task 2: /api/mission-control API (Priority: SECOND)

新增 API 返回聚合数据:
1. 活动流: 读取各角色 `memory/short-term.md`，diff 检测变化
2. 问题/告警: 角色停止运行、todo.md 有 P0 未处理
3. 任务总览: 聚合所有 `todo.md`，按优先级排列

## Reviewer Findings to Fix

Also address remaining P0s from reviewer:
- P0-2: Central AI mounts entire HOME directory — restrict to necessary dirs only
- P0-4: SSE `/api/refresh/subscribe` has no auth check — validate token param
- P1-2: Port allocation race condition — use atomic counter or immediate reservation
- P1-3: Unused imports in routes.ts after split
