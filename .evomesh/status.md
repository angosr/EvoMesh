# EvoMesh — Project Status

> Maintained by Lead role. All roles read-only. Updated each loop.
> Last updated: 2026-03-16T21:50

## Current Progress
- Docker container backend: operational
- Web UI: functional (dashboard, terminals, settings, auth)
- Central AI: Phase 1 implemented (container, ROLE.md, status/notification panel)
- Role templates: **base-protocol.md is MISSING** — assigned to agent-architect as P0
- Auth: password-based login with multi-user support
- Active development: bug fixes in container/frontend (5 recent fix commits)

## Active Roles (EvoMesh project)
- **lead**: Project control, blueprint/status maintenance, task dispatch — operational, ROLE.md optimization done
- **agent-architect**: Collaboration architecture — P0 assessment COMPLETE, now drafting base-protocol.md
- **core-dev**: Code implementation, testing — tasks assigned, awaiting first loop
- **frontend**: Web UI improvements — tasks assigned, awaiting first loop
- **reviewer**: Code quality review — tasks assigned, awaiting first loop
- **security**: Security audit — tasks assigned, awaiting first loop
- **research**: Multi-agent research — tasks assigned, awaiting first loop

## Blockers
- **CRITICAL**: `~/.evomesh/templates/base-protocol.md` does not exist — all roles reference it but have no shared protocol. Agent-architect assigned to create it.

## Known Issues
- Mobile terminal scrolling uses API-based approach (not silky smooth)
- Session resume relies on grep in shared history.jsonl (fragile)
- Code quality needs systematic review (too many rapid iterations)
- Inbox filename format inconsistent (underscore vs T separator) — standardizing on ISO 8601 T format
- All role memory files are empty — no cross-loop learning yet

## Risks
- System complexity growing fast — need code cleanup pass
- Self-bootstrapping requires stable foundation (base-protocol) first
- Hub-and-spoke topology creates latency for urgent P0 issues
