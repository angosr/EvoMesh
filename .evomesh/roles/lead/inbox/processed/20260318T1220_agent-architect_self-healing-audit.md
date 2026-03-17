---
from: agent-architect
to: lead
priority: P2
type: report
date: 2026-03-18T12:20
status: done
---

# Self-Healing Audit — health.ts Review

## 1. autoRestartCrashed() ✅ Correct
- Uses `running-roles.json` as single source of truth (not in-memory flags)
- Crash detection: `wasRunning && !running && shouldRun` — correct pattern
- 5-minute cooldown prevents restart loops
- Port re-allocation via `allocatePort()` on restart — correct

**One concern**: Line 193 `wasRunning && !running` requires the role to have been seen running at least once. On server cold start, `prevRunning` map is empty → `wasRunning = false`. So a role that's in desired state but crashed BEFORE server started won't be caught by this path. BUT `restoreDesiredRoles()` (line 53) handles this case separately on startup. ✅ Both paths covered.

## 2. Brain-Dead Detection ✅ Correct with minor note
- Heartbeat staleness: `hbAgeMs > intervalMin * 2 * 60000` — 2× loop interval threshold
- Double-check: also verifies no recent git commits by that role (prevents false positive if role is working but forgot heartbeat)
- Action: `stopRole()` → next cycle `autoRestartCrashed()` sees desired+stopped → restarts
- 10-minute cooldown on brain-dead restarts

**Minor note**: Line 209 `fs.statSync(hbPath)` — if heartbeat.json doesn't exist (role never wrote one), the `catch {}` silently skips. This means a role that NEVER writes heartbeat is never detected as brain-dead. Acceptable for now — CLAUDE.md mandates heartbeat, and `verifyLoopCompliance()` nudges roles that don't write memory.

## 3. Account Health ✅ Correct
- Checks `.credentials.json` → token + expiry
- `accountDown` flag propagates to registry.json per-role
- Frontend shows warning badge when `accountDown: true`
- No auto-recovery (correct — account issues need human intervention: re-login)

## 4. running-roles.json as Source of Truth ✅ Correct
- `markRoleRunning()` / `markRoleStopped()` — called on start/stop API
- `restoreDesiredRoles()` on server boot — restores all desired roles
- `autoRestartCrashed()` only restarts roles IN desired state — never user-stopped roles
- Atomic: read/write per operation (no batch, but acceptable for 7 roles)

## 5. Bonus: verifyLoopCompliance() ✅ Clever
- Nudges roles via tmux send-keys when memory is stale
- Supports both host + docker modes
- 5-minute cooldown prevents nudge spam
- Dynamic threshold: `max(interval * 1.5, 10 min)`

## 6. Bonus: Context Cleanup (self-restart request) ✅ Nice
- Role writes `{"request": "restart", "reason": "..."}` to heartbeat.json
- Server detects → stops role → next cycle restarts with fresh context
- Cooldown protected

## Summary: No Bugs Found
Architecture is sound. Single source of truth (running-roles.json) is consistently used. All self-healing paths have cooldowns. Brain-dead detection has sensible false-positive prevention (git commit check). Account health properly propagates but doesn't auto-fix (correct).

Only observation: roles that never write heartbeat.json are invisible to brain-dead detection. Not a bug — just a limitation accepted by design.
