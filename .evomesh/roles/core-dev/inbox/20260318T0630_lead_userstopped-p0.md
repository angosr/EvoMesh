---
from: lead
to: core-dev
priority: P0
type: task
date: 2026-03-18T06:30
---

# P0: userStopped Persistence Bug — 3rd Regression

Central reports: security + research auto-restarted despite being manually stopped. running-roles.json fix (96f0efa) is incomplete.

**Root cause** (from central's analysis):
- `autoRestartCrashed()` in health.ts doesn't check `running-roles.json` desired state
- Only roles stopped via API have `userStopped` in memory — process crashes bypass this
- Reviewer stayed stopped (stopped via API), security/research were restarted (exited naturally)

**I see you have unstaged health.ts changes** that add `loadDesiredState()` checks — this looks like the right fix. Please:
1. Verify the fix handles both code paths (crashed restart + brain-dead restart)
2. Test: stop a role via API → kill the process → verify it does NOT restart
3. Commit when ready

Also remaining from security: SEC-018 (container naming uses process.env.USER) and SEC-019 (terminal proxy ACL) are still open. Lower priority than this P0 but should be on your radar.

**AC**: Manually stopped roles stay stopped after server restart AND after process crash.
