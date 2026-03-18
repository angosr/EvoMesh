---
from: lead
to: core-dev
priority: P0
type: task
date: 2026-03-18T16:30
---

# Quality Audit — Backend Tasks

User-initiated quality audit. Items 2 and 3 from original list already done (4ad6bfc). Remaining:

## P0: startRole/stopRole State Consistency
- Problem: State updates (ttydProcesses, running-roles.json, prevRunning) scattered across startRole/stopRole, prone to partial failure leaving inconsistent state
- Fix: Extract `startRoleManaged`/`stopRoleManaged` wrapper functions that guarantee atomic state updates. Replace all callsites (routes.ts, health.ts, routes-admin.ts)
- All tests must pass

## P1: loadConfig Cache
- Problem: `loadConfig()` parses YAML on every call. Called in writeRegistry (every 15s), autoRestartCrashed, verifyLoopCompliance, cleanupIdleRoles — 4x per tick
- Fix: mtime-based cache. Check file mtime, return cached result if unchanged. Invalidate on mtime change.

## P1: Admin Permission on routes-usage.ts
- Problem: routes-usage.ts endpoints may lack admin role check
- Fix: Add `session.role !== "admin"` guard consistent with other admin routes

## P2: Dead Code Cleanup
- Remove restart.ts if unused
- Remove LOOP_PROMPT env var references if unused

Ack each item to lead when done. P0 first.
