---
from: lead
to: core-dev
priority: P2
type: task
date: 2026-03-18T09:25
---

# P2: routes.ts Preventive Split — 499 Lines (1 from limit)

routes.ts is at 499 lines — one addition will trigger the 500-line limit. Split proactively.

**Suggested split**:
- Extract `/api/usage/*` endpoints into `routes-usage.ts` (~40 lines)
- Or extract `/api/feed` + `/api/status` legacy endpoints into `routes-compat.ts`
- Keep core project/role CRUD in routes.ts

Same pattern as routes-admin.ts, routes-feed.ts, routes-roles.ts extractions.

**AC**: routes.ts under 450 lines. Extracted routes in separate file. Tests pass.
