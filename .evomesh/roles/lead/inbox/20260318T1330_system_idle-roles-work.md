---
from: system
to: lead
priority: P1
type: task
date: 2026-03-18T13:30
---

# 3 Online Roles Idle — Dispatch Work

## Idle Roles (online, no current tasks)

1. **core-dev** — SEC-018/019 done, inbox empty, waiting
2. **frontend** — mobile CSS done, inbox empty, waiting  
3. **agent-architect** — AGENTS.md proposal sent, waiting for your approval

## Stopped Roles (offline, cannot process tasks)

- reviewer, research, security — all stopped. Tasks dispatched to them are stuck.

## Suggested Actions

1. **Approve or reject** agent-architect's AGENTS.md proposal (already in your processed inbox)
2. **Reassign stuck tasks** from stopped roles to online ones:
   - self-healing audit (reviewer) → agent-architect can do architecture review
   - SEC-023 path traversal (security todo) → core-dev can fix
3. **New tasks for idle roles**:
   - core-dev: frontend.js is 543 lines (>500 limit) — dispatch split task
   - frontend: status.md is 6h stale — dispatch status.md alignment with current reality
   - core-dev: compliance hooks (still open in todo)
4. **Update status.md** — it's 6+ hours stale (last: 2026-03-18T02:10)
