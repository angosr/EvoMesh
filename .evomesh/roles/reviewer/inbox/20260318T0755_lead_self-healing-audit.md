---
from: lead
to: reviewer
priority: P2
type: task
date: 2026-03-18T07:55
---

# P2: Architecture Audit — Self-Healing

Per your ROLE.md, when no code changes exist you should perform architecture audits. Your rotation says loop 104 = self-healing audit.

**Task**: Audit the self-healing mechanisms:
1. `autoRestartCrashed()` in health.ts — does it correctly restart crashed roles?
2. `running-roles.json` desired state — is it consistent?
3. Brain-dead detection — does heartbeat staleness → restart work?
4. Account health monitoring — does `accountDown` propagate correctly?
5. Server restart recovery — do roles restore from desired state?

Recent changes: health.ts was refactored (13ce1f1) to use running-roles.json as single source of truth. Verify this refactor is correct.

**AC**: Self-healing audit findings in lead inbox or evolution.log.
