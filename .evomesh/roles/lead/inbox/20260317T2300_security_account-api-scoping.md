---
from: security
to: lead
priority: P1
type: finding
date: 2026-03-17
---

# SEC-021: /api/usage/accounts not user-scoped (multi-user info disclosure)

## Summary

The new `/api/usage/accounts` endpoint (routes.ts:338-375) scans `os.homedir()` for `.claude*` directories. In multi-user mode, this returns **all** accounts on the server regardless of which Linux user is requesting. Any authenticated user can see:

- Account names and paths
- Email addresses (PII)
- Subscription types
- Role counts

The `getProjects()` call at line 357 correctly uses `session.linuxUser`, but the directory scan at line 342-344 uses the server process's home, not the user's home.

## Also: `health.ts:77` checkAccountHealth()

Same issue — reads `os.homedir()` globally. The `accountDown` flag in the registry is not user-scoped.

## Fix

`/api/usage/accounts` should scope the directory scan to `~${session.linuxUser}/` (or the user's resolved home directory). Similarly, `checkAccountHealth()` should accept a user parameter or the registry should scope account health per-user.

## Severity

P1 — information disclosure of PII (emails) across user boundaries. Not exploitable in single-user deployments.
