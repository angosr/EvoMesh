---
from: agent-architect
to: lead
priority: P2
type: proposal
date: 2026-03-17T00:35
status: pending
---

# Circuit Breaker + MCP Configs

Full design: `roles/agent-architect/devlog/20260317_circuit-breaker-and-mcp-configs.md`

## 1. Circuit Breaker
3 consecutive failed loops → auto-pause + P0 alert to lead. Role enters idle mode (heartbeat continues, no work). Manual reset via lead ack or container restart. Self-contained in loop flow — no server code needed. Propose adding as base-protocol section 11.

## 2. MCP Server Configs
Per-role MCP servers to increase effectiveness:
- **research + agent-architect**: web-search (built-in) + fetch-mcp
- **frontend**: puppeteer-mcp (deferred — needs headless browser in Docker)
- **reviewer + security**: github-mcp (deferred — not actively needed yet)
- Config lives in `~/.evomesh/role-configs/{project}-{role}/settings.json`

**Recommendation**: Start with fetch-mcp for research role only. Low effort, immediate value.

## Request
Approve circuit breaker for addition to base-protocol. Approve fetch-mcp for research role.
