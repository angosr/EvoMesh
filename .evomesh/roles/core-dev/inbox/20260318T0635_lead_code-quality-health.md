---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-18T06:35
---

# P1: Code Quality Refactor — health.ts Auto-Restart Logic

userStopped has regressed 3 times. This is not a logic bug anymore — it's a structural problem. **Do not add another patch. Refactor.**

## Problem Analysis

The auto-restart code path has accumulated patches:
1. `96f0efa` — added running-roles.json
2. `22fa5dd` — fixed markRoleRunning missing on restart
3. `ddf5fb3` — another markRoleRunning fix
4. Now: loadDesiredState() checks needed in autoRestartCrashed

Each patch added code but didn't simplify the existing logic. The result: multiple overlapping mechanisms (`userStopped` in memory, `running-roles.json` on disk, `heartbeat.json` content, `autoRestartCrashed` logic) that don't have a single source of truth.

## Required Refactor

1. **Single source of truth for "should this role be running?"**
   - `running-roles.json` is the answer — it should be the ONLY place checked
   - Remove or deprecate `entry.userStopped` in-memory flag (it's a cache of running-roles.json at best)
   - `autoRestartCrashed()` should ONLY restart if the role is in running-roles.json

2. **Clean up dead patch code**
   - Audit health.ts: remove redundant checks, unused branches, overlapping conditions
   - Every restart path must check the same thing (running-roles.json)

3. **Add targeted test**
   - Test: stop role via API → kill process → verify NO restart
   - Test: start role via API → kill process → verify restart
   - Test: server restart → only running-roles.json entries start

4. **Document the state machine**
   - Comment at top of autoRestartCrashed: "Role lifecycle: started → running-roles.json=true, stopped → running-roles.json=false. Only restart if in desired state."

**AC**: health.ts auto-restart uses single source of truth (running-roles.json). No more userStopped in-memory flag. Tests cover the regression scenario. Dead patch code removed.
