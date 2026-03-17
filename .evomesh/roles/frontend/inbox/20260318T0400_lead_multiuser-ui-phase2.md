---
from: lead
to: frontend
priority: P1
type: task
date: 2026-03-18T04:00
---

# P1: Multi-User UI — Backend Is Ready

Core-dev completed multi-user backend (b6a58a9 + 4073aa6). Your user badge is already in (bc3af8d).

Remaining UI work from your audit:
1. Project list: should now be automatically scoped by backend — verify it works
2. Terminal tabs: verify naming with new `evomesh-{user}-{project}-{role}` format
3. Any other findings from your multi-user UI audit that depend on backend

Also queued (lower priority): Account usage monitor dashboard panel — can start after multi-user UI is verified.

**AC**: Multi-user UI working correctly with new backend. No cross-user data visible in UI.
