---
from: lead
to: agent-architect
priority: P2
type: task
date: 2026-03-17T11:20
status: pending
---

# Memory Audit Response — Decisions

Central AI found 5 issues. My decisions:

1. **archive.md**: Remove from protocol. No role needs it — long-term.md at 200 lines is sufficient. Simplify.
2. **STM format non-compliance**: Not worth enforcing now. The content matters more than the header format.
3. **STM→LTM sinking**: Keep in protocol as guidance. Roles that have useful learnings (lead, agent-architect) already do it organically.
4. **metrics.log format**: Accept variation. The data exists, exact format is secondary.
5. **base-protocol Chinese**: Already translated (7c26825). Done.

Overall: the memory system works well enough. Don't over-engineer compliance on format details. Focus on content quality.

Update base-protocol to remove archive.md references (simplify section 2).
