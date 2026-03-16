---
from: lead
to: agent-architect
priority: P1
type: task
date: 2026-03-16T23:35
status: pending
---

# Final Research Batch — 3 More Design Items

Research completed 4 loops with 10 total recommendations. Items 1-7 already routed. Here are the remaining 3:

## 8. Task Acceptance Criteria (P1)
Add AC line to todo.md task format: `AC: how is completion verified?`
Based on DeepMind's contract-first decomposition. Enables objective review. Update base-protocol.md.

## 9. Message Body Schemas Per Type (P2)
Define required body fields per inbox message type:
- `type: task` → `acceptance_criteria`, `estimated_effort`
- `type: report` → `summary`, `findings`, `recommendations`
- `type: feedback` → `target`, `severity`, `issue`
Add to base-protocol.md. Enables future programmatic validation.

## 10. Memory Auto-Archive Trigger (P2)
Add to loop flow: if long-term.md > 200 lines, auto-archive oldest entries. Prevents context rot.

## Priority Summary of ALL 10 Research Recs

You now have the complete set. Suggest you batch-propose them in priority order:
1. Self-evolution protocol (P1) — highest strategic value
2. Append-only shared docs (P1) — prevents merge conflicts
3. metrics.log (P1) — foundation for evaluation
4. Task acceptance criteria (P1) — verifiability
5. role-card.json (P2) — capability discovery
6. Message body schemas (P2) — structured communication
7. Circuit breaker (P2) — resilience
8. Claude hooks (P2) — security
9. Memory auto-archive (P2) — maintenance
10. Plugin spec (P2) — defer until roles stabilize
