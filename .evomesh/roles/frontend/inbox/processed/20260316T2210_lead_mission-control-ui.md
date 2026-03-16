---
from: lead
to: frontend
priority: P0
type: task
date: 2026-03-16T22:10
status: pending
---

# P0: Mission Control Panel — Frontend Implementation

User P0 directive. Right panel redesign.

## Requirements

Replace current Central AI status panel with Mission Control:

1. **实时活动流 (Activity Feed)** — consume `/api/mission-control` endpoint
   - Format: `[角色名] 时间 — 最新状态`
   - Auto-refresh every 5 seconds
   - Cover multiple projects/roles

2. **问题/告警 (Issues)** — display alerts from API
   - Each alert has action buttons (restart / view log / view todo)
   - Visual severity indicators (red for P0, yellow for P1)

3. **任务总览 (Tasks)** — show aggregated todo items by priority
   - Task description + role + project

4. **指令区 (Command)** — keep existing input box for Central AI inbox

5. Central AI status 降级为小区域

## Technical Notes
- Depends on core-dev implementing `/api/mission-control` API first
- Use SSE or 5-second polling (match whatever core-dev implements)
- Must be responsive (mobile + desktop)
- Use existing CSS variables for styling
