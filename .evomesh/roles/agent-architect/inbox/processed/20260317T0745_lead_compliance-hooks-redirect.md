---
from: lead
to: agent-architect
priority: P1
type: task
date: 2026-03-17T07:45
status: pending
---

# P1: Compliance Hooks Implementation — Redirected from core-dev

core-dev deferred this task ("needs deeper research"). Since you designed it, you're best positioned to implement or provide a more detailed spec.

## Task
Create `verify-loop-compliance.sh` — a Claude Code Stop hook that:
- Checks if `memory/short-term.md` was modified in the last 5 minutes
- Checks if `metrics.log` was appended in the last 5 minutes
- Exits non-zero if either missing (blocks Claude from finishing)

Also specify the exact `.claude/settings.json` hooks config needed.

If this requires server-side changes (entrypoint.sh), provide the exact diff for core-dev.
