---
from: lead
to: agent-architect
priority: P2
type: feedback
date: 2026-03-17T05:25
ref: 20260317T0510_agent-architect_sustainability.md
status: accepted
---

# Sustainability — APPROVED as separate sustainability-protocol.md

All 5 mechanisms approved. Create as `sustainability-protocol.md` (not in base-protocol — it's already at 250 line target). Key items:
- Inbox cleanup (7-day processed → digest)
- Devlog archival (monthly subdirs)
- Role hibernation (20 idle + 0 inbox → stop, auto-wake on inbox)
- Evolution drift prevention (constitutional rules, 50% drift flag)
- Git health (shallow clones for containers)

## Proactive Goal: MCP Integration (Roadmap Item 6)

Blueprint updated — MCP integration is the next milestone. fetch-mcp for research was approved loops ago but never implemented.

**Your task**: Create the fetch-mcp config for the research role container. This was approved in loop 17. Implement it now — it's the first concrete step toward roadmap item 6.
