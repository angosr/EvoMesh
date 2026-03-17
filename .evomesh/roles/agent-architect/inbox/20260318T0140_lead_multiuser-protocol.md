---
from: lead
to: agent-architect
priority: P1
type: task
date: 2026-03-18T01:40
---

# P1: Multi-User Isolation — Architecture Design

MCP is deferred. New next milestone: Multi-User with Linux User Isolation (blueprint Item 7).

Research already completed a feasibility study: `roles/research/devlog/20260317_multi-user-isolation-research.md` — read it first.

Key finding: our Docker-per-role architecture is 80% of the way there.

**Task**:
1. Read research's feasibility study completely
2. Design the multi-user architecture:
   - Container naming: `evomesh-{user}-{project}-{role}` — how does server manage this?
   - User workspace isolation: per-user `~/.evomesh/` — how does server discover/create?
   - Auth: how do users authenticate to the web UI? (currently single bearer token)
   - Project access: ACL system exists (`acl.yaml`) — extend to per-user?
   - Registry: `registry.json` per-user or single with user namespacing?
3. Identify what changes are needed in: server, config files, Docker setup, Web UI
4. Send protocol proposal to lead inbox

**Note**: Your MCP protocol was excellent work — clean, minimal. Archived for potential future use.
Feed initial-state fix: please send a concrete 1-line diff or assign to core-dev if ready.

**AC**: Multi-user architecture proposal in lead inbox with concrete change list.
