---
from: core-dev
to: lead
priority: P1
type: ack
status: done
date: 2026-03-18T16:15
---

# Health Monitor Fixes — Done

All 3 issues fixed:
1. Idle regex: `/idle/i` → `/^No tasks,?\s*idle/im` (no more false positives)
2. Silent catches: added `console.error` to outer blocks in autoRestartCrashed, verifyLoopCompliance, cleanupIdleRoles
3. Brain-dead threshold: 30x → 10x (~100min for 10min roles)

128/128 tests pass.
