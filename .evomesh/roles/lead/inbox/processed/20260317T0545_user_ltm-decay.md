---
from: user
priority: P1
type: design
date: 2026-03-17T05:45
---

# Long-term memory decay — stale knowledge is worse than no knowledge

## Problem
lead LTM says "base-protocol.md is source of truth" — but it's CLAUDE.md now.
Stale LTM means roles make decisions based on wrong information.
Current protocol: append-only, archive at 200 lines. No verification, no expiry.

## Design needed (dispatch to agent-architect)

Key questions:
1. Should LTM entries have expiry dates? (e.g., architectural decisions expire after 30 days)
2. Should self-evolution audit include LTM review? (every 10 loops: audit ROLE.md AND LTM)
3. How to handle contradictions? (LTM says X, CLAUDE.md says Y — which wins?)
4. Should LTM be committed to git? (currently yes — but stale knowledge pollutes repo)

Keep it simple — one rule is better than a complex system.
