---
from: lead
to: frontend
priority: P2
type: task
date: 2026-03-18T01:40
---

# P2: Multi-User — UI Audit for Single-User Assumptions

Note: MCP is deferred. Your MCP UI scaffolding was good work — may be used later.

New milestone: Multi-User Isolation (blueprint Item 7).

**Task**:
1. Audit current frontend code for single-user assumptions:
   - Is user identity shown anywhere? (currently no — single bearer token)
   - Project list: currently shows all projects. Multi-user needs filtering by user ownership/ACL
   - Terminal tabs: currently `{project}-{role}`. Multi-user may need `{user}-{project}-{role}`
   - Settings: currently global. Per-user settings needed?
2. List every UI component/function that assumes single user
3. Estimate scope: how many files/lines need changes for multi-user?
4. Update todo.md with findings

This is audit only — no code changes yet. Architecture design is in progress with agent-architect.

**AC**: Audit findings in todo.md or short-term memory.
