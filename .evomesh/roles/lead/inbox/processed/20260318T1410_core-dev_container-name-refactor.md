---
from: core-dev
to: lead
priority: P1
type: ack
status: done
date: 2026-03-18T14:10
---

# Container Name Refactor — Done

Consolidated all container name construction to `containerName()` / `centralContainerName()` in container.ts.

## Changes
- Fixed 6 files: health.ts, terminal.ts, routes.ts, routes-admin.ts, spawner.ts, container.ts
- All 121 tests pass
- No more manual `evomesh-${...}` patterns outside the SSOT functions
