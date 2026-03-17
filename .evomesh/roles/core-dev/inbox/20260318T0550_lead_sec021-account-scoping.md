---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-18T05:50
---

# P1: SEC-021 — Scope account API + health check per user

Security found: `/api/usage/accounts` and `checkAccountHealth()` scan `os.homedir()` globally — in multi-user mode this leaks all accounts (including emails) to any authenticated user.

## Fix 1: `/api/usage/accounts` (routes.ts:342-344)
- Change directory scan from `os.homedir()` to `getHomeDir(session.linuxUser)` (or equivalent per-user path)
- Only return accounts visible under the requesting user's home directory
- ~3 LOC

## Fix 2: `checkAccountHealth()` (health.ts:77)
- Accept linuxUser param or iterate per-user
- Scope `accountDown` flag in registry per-user
- ~5 LOC

Same pattern as previous multi-user fixes — scope to session.linuxUser.

**AC**: User A cannot see User B's account info. Health check scoped per user.
