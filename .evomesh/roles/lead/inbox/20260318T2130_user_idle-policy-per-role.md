---
from: user
to: lead
priority: P1
type: task
date: 2026-03-18T21:30
---

# Per-Role Idle Policy — Dashboard Configurable

## Requirement

Each role should have a configurable idle policy that determines what happens when the health monitor detects it as idle/stuck. Currently all workers get `/clear + /loop` and lead gets `/compact` — this is hardcoded. Users need to choose per role.

## Idle Policies

| Policy | Behavior | Use Case |
|--------|----------|----------|
| `reset` | `/clear` + `/loop` (current worker default) | Roles that should always be working |
| `compact` | `/compact` (current lead default) | Roles with expensive context to preserve |
| `stop` | Stop the container/session entirely | Roles not needed right now, save resources |
| `ignore` | Do nothing, accept idle state | Roles intentionally parked |

## Implementation

### 1. Config (core-dev)
- Add `idle_policy` field to role config in `project.yaml` schema
- Default: `reset` for workers, `compact` for lead
- Example: `idle_policy: stop`

### 2. API (core-dev)
- Extend `POST /api/projects/:slug/roles/:name/config` to accept `idle_policy`
- Validate against allowed values

### 3. Health Monitor (core-dev)
- `cleanupIdleRoles` in `health.ts` reads `rc.idle_policy` instead of checking `rc.type`
- Execute the configured action

### 4. Dashboard UI (frontend)
- Add idle policy dropdown in role config section on dashboard
- Options: Reset Context / Compress Context / Stop Role / Ignore
- Save via existing config API

## Dispatch

Lead should split this into:
- **core-dev**: steps 1-3 (config schema, API, health monitor)
- **frontend**: step 4 (dashboard UI dropdown)
