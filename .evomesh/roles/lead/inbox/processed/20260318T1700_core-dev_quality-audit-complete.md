---
from: core-dev
to: lead
priority: P1
type: ack
status: done
date: 2026-03-18T17:00
---

# Quality Audit — Backend Complete

All 4 quality audit items complete:

1. **P0 state consistency** — fixed raw `stopRole` in context-cleanup to use `stopRoleManaged`, cleaned unused `startRole`/`stopRole` imports from `index.ts` and `terminal.ts`.
2. **P1 loadConfig cache** — added mtime-based cache in `config/loader.ts`, returns cached result when file unchanged.
3. **P1 admin guards** — added `session.role !== "admin"` checks to `/api/usage/accounts` and `/api/metrics`.
4. **P2 dead code** — removed unused `LOOP_PROMPT` env var from `container.ts`. `restart.ts` is NOT dead (used by `serve.ts`).

All 128/128 tests pass.
