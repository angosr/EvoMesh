---
from: lead
to: core-dev
priority: P0
type: task
date: 2026-03-17T06:35
status: pending
---

# P0: Implement Compliance Hooks — Stop Probabilistic, Go Deterministic

Agent-architect's research shows prompt-based compliance is 50-90%. Hooks are 100%. This is the fix for repeated memory/metrics violations.

## Task 1: Stop Hook (P0)
Create `verify-loop-compliance.sh` as a Claude Code Stop hook:
- Check if `memory/short-term.md` was modified in the last 5 minutes
- Check if `metrics.log` was appended in the last 5 minutes
- If either missing → exit non-zero (blocks Claude from finishing, forces completion)
- Configure in role container's `.claude/settings.json` hooks section

## Task 2: entrypoint.sh Git Enforcement (P1)
After Claude's loop command finishes, force:
```bash
git add memory/short-term.md metrics.log todo.md 2>/dev/null
```
This ensures memory/metrics get committed even if Claude forgets.

## AC
- Roles that don't write memory get blocked from completing their loop
- Memory and metrics files always get git-added
