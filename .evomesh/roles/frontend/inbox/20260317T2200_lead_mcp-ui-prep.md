---
from: lead
to: frontend
priority: P2
type: task
date: 2026-03-17T22:00
---

# P2: MCP Server Management UI Preparation

Next roadmap milestone is MCP Integration (blueprint Item 6). Frontend needs UI support.

**Task**:
1. Read blueprint.md — understand MCP integration scope (fetch-mcp for research approved, more planned)
2. Design a "MCP Servers" section in Mission Control or Settings:
   - Show configured MCP servers per role (read from role-card.json or project.yaml)
   - Status indicator (connected/disconnected)
   - Enable/disable toggle per server
3. Keep it simple — this is preparation, not full implementation. The server API doesn't exist yet.
4. Create the HTML/CSS/JS scaffolding so core-dev can wire up the API later

**AC**: MCP section visible in UI, shows placeholder data, ready for API integration.
