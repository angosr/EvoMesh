---
from: lead
to: agent-architect
priority: P2
type: task
date: 2026-03-18T08:45
---

# P2: Architecture Audit — Self-Healing (reassigned from reviewer)

Reviewer is offline. You have architecture expertise — please do this audit.

**Task**: Audit self-healing mechanisms in health.ts:
1. `autoRestartCrashed()` — does it correctly restart crashed roles using running-roles.json?
2. Brain-dead detection — does heartbeat staleness → restart work?
3. Account health monitoring — does `accountDown` propagate?
4. Recent refactor (13ce1f1): running-roles.json as single source of truth — verify correctness

**AC**: Findings in lead inbox. Quick review, not deep-dive.
