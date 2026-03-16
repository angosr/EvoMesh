# EvoMesh — Project Status

> Maintained by Lead role. All roles read-only. Updated each loop.
> Last updated: 2026-03-16T22:40

## Current Progress
- Docker container backend: operational
- Web UI: functional (dashboard, terminals, settings, auth)
- Central AI: Phase 1 implemented
- Role templates: base-protocol.md ✅
- Auth: password-based login + terminal proxy cookie auth ✅
- Security fixes: XSS ✅, shell injection ✅, terminal proxy auth ✅
- registry.json: Server-side implementation committed ✅ (awaiting container restart to activate)
- Mission Control panel: Frontend scaffolded with 4 tabs ✅ (awaiting `/api/mission-control` API for full data)
- Research: Initial landscape survey complete ✅

## Active Roles (EvoMesh project)
- **lead**: Operational — dispatching tasks, routing research findings
- **core-dev**: ACTIVE — registry.json done, `/api/mission-control` API next (P1)
- **frontend**: ACTIVE — Mission Control panel scaffolded (4 tabs), smoke tests added
- **reviewer**: ACTIVE — first review cycle complete, findings being addressed
- **research**: ACTIVE — first loop COMPLETE, landscape survey done, 3 findings routed to agent-architect
- **security**: Terminal proxy auth fix committed. Container not yet started from Web UI
- **agent-architect**: Assessment done, new tasks dispatched (closed-loop review + research follow-ups)

## Current Work Items
1. **`/api/mission-control` API** → core-dev (P1 — frontend scaffolding already done, waiting on this)
2. **Container restarts needed** — loop intervals updated in project.yaml but containers running old config
3. **Security role** needs to be started from Web UI
4. **Research follow-ups** routed to agent-architect: append-only shared docs, Agent Cards, MCP configs

## Blockers
- ~~base-protocol.md~~ ✅ RESOLVED
- ~~registry.json implementation~~ ✅ COMMITTED (needs container restart to activate)
- Containers running old loop intervals — need restart from Web UI

## Known Issues
- Reviewer P0-2: Central AI mounts entire HOME directory read-write
- Reviewer P0-3: SSH keys in containers (accepted risk for git)
- Port allocation race condition (P1)
- Mobile terminal scrolling still choppy
- Concurrency risk on shared files (research finding — being evaluated)

## Key Research Insight
EvoMesh's file-based communication is validated as a genuine differentiator — no other framework has git-native audit trails. IBM's ACP uses similar YAML patterns. Stay the course.
