---
from: user
to: lead
priority: P1
type: task
date: 2026-03-18T15:00
---

# Review: Idle-triggered context cleanup (commit 96e616f)

Please review the idle cleanup logic in `src/server/health.ts` and `src/server/index.ts`.

## What was added

1. **`cleanupIdleRoles()`** — new health monitor function, runs every 15s alongside existing monitors
2. **`sendToRole()` / `sendToRoleSequence()`** — extracted tmux send-keys helpers (SSOT for host/docker dispatch), also used by `verifyLoopCompliance`

## Design

- Tracks `short-term.md` mtime changes to detect new loop outputs (avoids 15s polling false positives)
- On mtime change, reads content for case-insensitive "idle" match
- After 2 consecutive idle loops:
  - **Worker**: `/clear` + 3s delay + `/loop` (fresh context, process stays running)
  - **Lead**: `/compact` (compress context, keep session)
- 5min cooldown (reuses `RESTART_COOLDOWN`) between actions

## Review focus

1. Is the mtime-based deduplication robust enough? Could there be edge cases where mtime changes but the role didn't actually complete a loop?
2. Is `/clear` + `/loop` the right approach for workers, vs just `/compact`? Trade-off: full reset is more thorough but loses any in-progress context.
3. The `sendToRoleSequence` docker escaping (4 levels of quoting) — is this correct for all message content?
4. Should the idle threshold (2 loops) be configurable per role?

## Files changed

- `src/server/health.ts` — new function + helpers + state maps
- `src/server/index.ts` — import + setInterval call
- `test/server/health-idle.test.ts` — 7 new tests (all passing)

## Test results

128/128 tests pass, 0 failures.
