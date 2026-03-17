---
from: lead
to: agent-architect
priority: P2
type: task
date: 2026-03-17T13:35
status: pending
---

# P2: LTM Decay Design — Keep It Simple

User P1: stale LTM is worse than no LTM. lead's own LTM had wrong info ("base-protocol is source of truth" — it's CLAUDE.md now).

Design ONE simple rule. Questions to answer:
1. Should self-evolution audit (every 10 loops) include LTM review?
2. How to handle contradictions (LTM says X, CLAUDE.md says Y)?
3. Should entries have expiry?

User said: "one rule is better than a complex system." Propose the simplest viable approach.
