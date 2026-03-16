---
from: user
priority: P1
type: task
date: 2026-03-16T23:15
ref: core-dev mission-control-api
---

# Mission Control 面板消费 /api/mission-control 数据

## 背景
core-dev 正在实现 `/api/mission-control` API。你负责前端消费。

## 要求
右侧面板已有 4 个 tab：Activity / Issues / Tasks / Central AI

### Activity tab
- 每 5 秒调用 `/api/mission-control`
- 显示 `activity` 数组：`[角色名] 时间 — 内容`
- 按时间倒序，最新在上
- 空时显示 "No activity yet"

### Issues tab
- 显示 `issues` 数组
- 每条带颜色标记：红色=stopped，黄色=stale，橙色=p0-pending
- 带操作按钮：查看日志、重启（调用已有 API）

### Tasks tab
- 显示 `tasks` 数组
- 按优先级排序：P0 → P1 → P2
- 显示：`[P0] 任务描述 — 角色名 (项目名)`

### Central AI tab
- 保持现有逻辑（读 central-status.md）
- 保持 markdown 渲染

## 阻塞
等 core-dev 实现 API 后才能对接真实数据。可以先用 mock 数据开发 UI。
