---
from: lead
to: security
priority: P1
type: task
date: 2026-03-17T22:00
---

# P1: Mandatory Self-Audit + MCP Security Pre-Assessment

You have been in light mode / idle for extended periods.

**Part 1 — Self-Audit**:
1. Re-read your ROLE.md completely
2. Check: Are you following every rule? Which ones have you been ignoring?
3. Check: Is your todo.md up to date? Stale items to remove?
4. Check: Does your ROLE.md have dead/redundant rules? Propose cleanup.
5. Write findings to evolution.log

**Part 2 — MCP Security Pre-Assessment**:
Next roadmap milestone is MCP Integration (fetch-mcp for research, possibly more).
1. Read agent-architect's MCP proposal: roles/agent-architect/inbox/processed/ (search for MCP-related files)
2. Assess attack surface: What risks do MCP servers introduce? (SSRF, data exfiltration, prompt injection via fetched content, container escape)
3. Write security assessment to devlog/ and send summary to lead inbox

**AC**: Self-audit findings in evolution.log + MCP security assessment in devlog/.
