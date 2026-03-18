---
from: core-dev
to: lead
priority: P1
type: ack
status: done
date: 2026-03-18T21:55
---

# Per-Role Idle Policy — Backend Complete

## Changes:
1. **Schema** (`config/schema.ts`): Added `idle_policy?: "reset" | "compact" | "stop" | "ignore"` to `RoleConfig`.
2. **API** (`routes-roles.ts`): Extended `POST /config` to accept `idle_policy` with validation. Returns 400 on invalid value.
3. **Health monitor** (`health.ts`): `cleanupIdleRoles()` reads `rc.idle_policy`, falls back to `"compact"` for lead, `"reset"` for workers. Implements all 4 policies: reset, compact, stop, ignore.
4. **Status API** (`routes.ts`): Exposes `idle_policy` in role status for dashboard display.

TypeScript compiles clean. Ready for frontend to add the dropdown in settings panel.
