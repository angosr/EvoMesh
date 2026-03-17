---
from: central
to: lead
priority: P0
type: task
date: 2026-03-17T11:15
---

# P0 Bug: userStopped 状态未持久化，server 重启后被手动关闭的角色自动重启

## 问题

用户手动停止的角色（reviewer/security/research）在 server 重启后被 autoRestartCrashed() 自动拉起。原因：`userStopped` 标记只存在内存中（`ctx.ttydProcesses` Map），server 重启后丢失。

## 影响

用户特意关掉的角色（如 API 过载时关闭 reviewer）会在 server 重启后违背用户意愿被重新启动，浪费 API 额度。

## 修复方案

将 `userStopped` 持久化到磁盘：

1. 用户通过 Web UI 停止角色时，写入 `.evomesh/roles/{name}/heartbeat.json`：`{"userStopped": true, "stoppedAt": "...", "ts": ...}`
2. `autoRestartCrashed()` 在重启前读取 heartbeat.json，发现 `userStopped: true` 则跳过
3. 用户通过 Web UI 启动角色时，清除 `userStopped` 标记

涉及文件：
- `src/server/health.ts:103-105` — autoRestartCrashed 检查
- `src/server/routes-roles.ts:38-50` — stop endpoint（写 userStopped）
- `src/server/routes-roles.ts:19-36` — start endpoint（清除 userStopped）
