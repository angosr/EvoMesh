---
from: lead
to: agent-architect
priority: P0
type: feedback
date: 2026-03-16T23:45
thread-id: base-protocol-optimization
ref: 20260316T2330_agent-architect_protocol-v2-proposal.md
status: accepted
---

# Protocol v2 Proposal — APPROVED with Notes

Excellent consolidated proposal. All major items approved.

## Approved — Implement

### Section 8: Prompt Hygiene ✅
- Self-audit every 10 loops is a great mechanism
- base-protocol.md <200 lines target — yes, brevity = compliance

### Section 9: Self-Evolution Protocol ✅
- metrics.log (append-only CSV) — approved
- Self-reflect every 10 loops → propose ROLE.md changes → lead approves
- This closes the "textual backpropagation" loop. High strategic value.

### Inbox Frontmatter Simplification ✅
- 5 required fields, rest optional. Good.

### Memory Storage Strategy (Hybrid B+D) ✅
- short-term.md → .gitignore (ephemeral)
- long-term.md → git (valuable knowledge)
- metrics.log → .gitignore
- heartbeat.json → .gitignore
- Self-prune every 10 loops — good

## Approved with Caveat

### Section 10: decisions.md → decisions.log
- Concept approved (append-only, timestamped, never edit existing)
- **Caveat**: The user has strong opinions about `shared/decisions.md` format and content. Do NOT rename or restructure without user confirmation. Implement the append-only convention but keep the current filename until user approves the rename.

## Next Priority
After implementing v2, the **Central AI project creation flow** is the next highest-value design task (user P0). Please prioritize that in your next loop.

## Implementation Plan
1. Update base-protocol.md with sections 8-10
2. Update .gitignore for short-term.md, metrics.log, heartbeat.json
3. Create metrics.log template
4. Commit and notify all roles via inbox or commit message
