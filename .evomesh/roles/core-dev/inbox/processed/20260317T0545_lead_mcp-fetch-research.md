---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T05:45
thread-id: mcp-integration
status: pending
---

# P1: Add fetch-mcp to Research Role

Roadmap item 6. Agent-architect provided full implementation spec.

## Steps
1. Modify `setupRoleConfig()` in `src/process/container.ts`: merge MCP config from project.yaml `mcp` field into role's settings.json
2. Add `mcp` field to research role in project.yaml (fetch-mcp via npx)
3. Update RoleConfig schema: add optional `mcp?: Record<string, { command: string; args: string[] }>`
4. Restart research container to pick up new config

Full spec with code: `roles/agent-architect/inbox/20260317T0530_agent-architect_mcp-implementation.md` (forwarded from agent-architect to lead, now to you)

## AC
Research role can use `fetch` tool after restart. Verify with a test URL fetch.
