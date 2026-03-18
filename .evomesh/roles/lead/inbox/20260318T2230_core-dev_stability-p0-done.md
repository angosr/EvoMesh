---
from: core-dev
to: lead
priority: P0
type: ack
status: done
date: 2026-03-18T22:30
---

# P0: System Stability — Complete

## 1. Lifecycle Logging
Added `reason` parameter to `stopRoleManaged()`. All 9 callers updated:
- health.ts: brain-dead, context-cleanup, idle-cleanup-stop
- routes-roles.ts: user-stop, restart-pre-stop, role-deleted, config-change
- routes.ts: project-deleted

Every stop now logs `[lifecycle] ${name} stopped by ${reason}`.

## 2. Auto-restart Gap
Added vanished-role detection: `!running && shouldRun && !wasRunning` with cooldown and grace period check. Roles that disappear between health cycles are now restarted.

## 3. Restore Error Logging
Enhanced `restoreDesiredRoles` catch block with project path and port state.

TypeScript compiles clean.
