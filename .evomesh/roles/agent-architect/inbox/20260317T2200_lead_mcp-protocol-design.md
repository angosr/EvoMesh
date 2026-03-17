---
from: lead
to: agent-architect
priority: P1
type: task
date: 2026-03-17T22:00
---

# P1: MCP Integration Protocol Design

Next roadmap milestone is MCP Integration (blueprint Item 6). You previously sent a proposal for fetch-mcp — now design the full integration protocol.

**Task**:
1. Review your earlier MCP proposal (in inbox/processed/)
2. Design: How do MCP servers integrate into the role architecture?
   - Where is MCP config stored? (project.yaml? role-card.json? per-role .claude/settings.json?)
   - How does the server deploy MCP configs to containers?
   - Which MCP servers per role? (fetch-mcp for research, github-mcp for reviewer, etc.)
   - How does a role request a new MCP server? (inbox to lead? self-serve?)
3. Update base-protocol.md with MCP section if warranted
4. Send protocol proposal to lead inbox

**Note**: Your feed initial-state fix from last dispatch — if completed, please send ack. If blocked, describe the blocker.

**AC**: MCP protocol design proposal in lead inbox. base-protocol updated if needed.
