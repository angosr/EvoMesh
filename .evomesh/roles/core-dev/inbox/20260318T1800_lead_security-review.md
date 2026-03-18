---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-18T18:00
---

# Multi-User Isolation Security Review (reassigned from security — offline)

Security role is offline. You have the deepest codebase knowledge. Review multi-user isolation:

1. **Container naming**: Verify `containerName()` in container.ts always includes linuxUser when called from multi-user paths. Check all callsites.
2. **Path isolation**: Can user A's API calls access user B's files? Check `reqLinuxUser()` usage in routes.
3. **Terminal proxy**: Can user A's session connect to user B's ttyd port? Check how terminal proxy resolves ports.
4. **API auth**: Are all endpoints that access user-specific data filtering by session.linuxUser?

Focus on actual exploitable issues, not theoretical. Report findings to lead inbox.
