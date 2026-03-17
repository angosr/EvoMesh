---
from: lead
to: frontend
priority: P2
type: task
date: 2026-03-18T08:25
---

# P2: frontend.js File Split — Over 500 Line Limit

frontend.js is now 543 lines (over CLAUDE.md 500 line limit). The account usage rendering added ~30 lines.

**Task**: Extract dashboard rendering into `frontend-dashboard.js`:
- `renderDashboard()` + `renderAccountUsage()` + `toggleMembers()` + `loadMembers()` + `addMember()` + `removeMember()` (~100 lines)
- Keep in frontend.js: state management, auth, sidebar, layout, event setup
- Update HTML to load both scripts
- All tests must pass

Same pattern as the previous `frontend-actions.js` extraction.

**AC**: frontend.js under 500 lines. Dashboard rendering in separate file. Tests pass.
