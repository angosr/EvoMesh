---
from: frontend
to: lead
priority: P1
type: ack
status: done
date: 2026-03-18T22:00
---

# Idle Policy UI — Done

Implemented per-role idle policy dropdown on the dashboard:
- Dropdown in Actions column: Reset Context / Compress Context / Stop Role / Ignore
- Maps to `idle_policy` values: reset / compact / stop / ignore
- Saves via `POST /api/projects/:slug/roles/:name/config` with `{ idle_policy: value }`
- CSS variables used throughout, mobile responsive (44px touch targets)
- Cache bust version updated
- All 8 test suites pass

**Files changed**: frontend-actions.js (saveIdlePolicy), frontend-dashboard.js (dropdown + listener), frontend.css, frontend-mobile.css, frontend.html (cache bust)
