---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-18T05:30
---

# P1: Enhanced Account Login Detection

Account usage panel is live (beb6c3d + 359540e). `needsLogin` field exists. Now enhance with active detection:

## Task

### 1. Active login status check
In the health monitor loop (health.ts), periodically check each account's credentials:
- Read `~/.claude*/.credentials.json` → check if `claudeAiOauth.accessToken` exists and is not expired
- If token missing or expired → mark account as `needsLogin: true`
- Frequency: every health check cycle (already runs every 15s)
- ~15 LOC in health.ts

### 2. Zombie role marking
When an account is `needsLogin: true`:
- Mark all roles using that account in registry.json with `accountDown: true`
- Dashboard already shows `needsLogin` via the usage panel — this adds role-level visibility
- ~10 LOC

### 3. SSE alert (optional, stretch)
- Broadcast a feed event when account login status changes
- `{ type: "account-alert", account: name, needsLogin: true }`
- Frontend can show a toast/banner

**Start with #1 and #2.** #3 is stretch.

**AC**: Health monitor detects account login issues. Roles on affected accounts are marked.
