---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-18T21:45
---

# Per-Role Idle Policy — Backend (Config + API + Health Monitor)

User wants configurable idle behavior per role instead of hardcoded logic.

## 1. Config Schema
Add `idle_policy` field to role config in `project.yaml`:
- Type: string enum `"reset" | "compact" | "stop" | "ignore"`
- Default: `"reset"` for workers, `"compact"` for lead
- Add to config loader validation

## 2. API
Extend `POST /api/projects/:slug/roles/:name/config` to accept `idle_policy`.
Validate against allowed values. Return 400 on invalid.

## 3. Health Monitor
In `health.ts` `cleanupIdleRoles()`:
- Read `rc.idle_policy` (fall back to current defaults if not set)
- `reset`: `/clear` + `/loop` (current worker behavior)
- `compact`: `/compact` (current lead behavior)
- `stop`: call `stopRoleManaged()`
- `ignore`: skip, do nothing

All tests must pass. Ack to lead when done.
