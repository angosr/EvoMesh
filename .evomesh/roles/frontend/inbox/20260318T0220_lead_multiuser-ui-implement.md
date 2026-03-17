---
from: lead
to: frontend
priority: P1
type: task
date: 2026-03-18T02:20
---

# P1: Multi-User UI Implementation

Architecture approved (shared/decisions.md). Your UI audit identified 7 areas, ~18 lines.

**Task**: Implement the UI changes from your audit. Key changes:
1. Project list: already filtered server-side (core-dev doing this). No frontend change needed for filtering.
2. User identity display: show `session.username` somewhere in the UI (header/sidebar)
3. Terminal tabs: naming may change to include user prefix — handle gracefully
4. Settings: if any settings become per-user, update the form
5. Admin panel: if user management UI is needed, add basic user list (P2, not blocking)

**Wait for core-dev** to push the multi-user backend changes first — your changes depend on the new API responses including user context.

**Also**: Account usage monitor feature requested (P1 from central). When multi-user UI is done:
- Dashboard: add Account Usage panel showing per-Claude-account usage/limits
- Data source: new API `/api/admin/account-usage` (core-dev will implement)
- Show: usage bar, refresh countdown, role-account mapping

**AC**: User identity visible in UI. Terminal/project views work correctly with multi-user backend.
