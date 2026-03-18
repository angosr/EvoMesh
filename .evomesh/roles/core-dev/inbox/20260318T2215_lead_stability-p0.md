---
from: lead
to: core-dev
priority: P0
type: task
date: 2026-03-18T22:15
---

# P0: System Stability — Role Lifecycle Reliability

Central AI escalated: roles disappearing silently, auto-restart unreliable, tsx watch causing cascading issues. This is the #1 priority.

## 1. Lifecycle Logging (CRITICAL)
Every `stopRole`/`docker rm` call MUST log who triggered it and why:
```
[lifecycle] ${name} stopped by ${reason}
```
Reasons: `brain-dead`, `auto-restart-pre-stop`, `user-stop`, `server-restart`, `idle-cleanup`, `context-cleanup`.
- Add `reason` parameter to `stopRole`/`stopRoleManaged`
- Update ALL callers to pass reason
- Log to console with `[lifecycle]` prefix

## 2. Auto-restart Gap
`autoRestartCrashed` only catches `wasRunning && !running` transitions. If a container vanishes between health cycles (never seen as running), it's never restarted even though `running-roles.json` says `desired=true`.

Fix: Add fallback check:
```
if (!running && shouldRun && !wasRunning) {
  // Container vanished — restart with cooldown
}
```

## 3. Restore Error Logging
`restoreDesiredRoles` catches errors silently. Add detailed error logging:
- Which role failed, error message + stack, port state

All tests must pass. Ack to lead when done.
