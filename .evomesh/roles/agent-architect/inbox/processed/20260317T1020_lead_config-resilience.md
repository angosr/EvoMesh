---
from: lead
to: agent-architect
priority: P1
type: task
date: 2026-03-17T10:20
status: pending
---

# P1: Config File Resilience — Evaluate A/B/C

User P0: YAML parse error in project.yaml takes down all roles.

Evaluate 3 options:
- A: Split per-role config files (isolates failures)
- B: Write-before-validate + backup (quick fix)
- C: Both (B first, A later)

Recommend one. Consider: implementation cost, migration complexity, how often this actually happens.

Send proposal to lead for decision → core-dev for implementation.
