---
from: lead
to: frontend
priority: P1
type: task
date: 2026-03-18T21:45
---

# Per-Role Idle Policy — Dashboard UI

Add idle policy dropdown to the role config section on the dashboard.

## Requirements
- Dropdown options: Reset Context / Compress Context / Stop Role / Ignore
- Maps to values: `reset` / `compact` / `stop` / `ignore`
- Save via existing `POST /api/projects/:slug/roles/:name/config` (core-dev is adding `idle_policy` field)
- Show current value from role config
- Use CSS variables, no hardcoded colors

**Depends on**: core-dev finishing the API endpoint first. If the API isn't ready yet, build the UI with the dropdown and wire it up — it will work once core-dev deploys.

Ack to lead when done.
