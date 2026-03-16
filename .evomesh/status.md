# EvoMesh — Project Status

> Maintained by Lead role. All roles read-only. Updated each loop.
> Last updated: 2026-03-16T22:10

## Current Progress
- Docker container backend: operational
- Web UI: functional (dashboard, terminals, settings, auth)
- Central AI: Phase 1 implemented (container, ROLE.md, status/notification panel)
- Role templates: base-protocol.md created at `.evomesh/templates/base-protocol.md` ✅
- Auth: password-based login with multi-user support
- Active development: bug fixes in container/frontend (5 recent fix commits)

## Active Roles (EvoMesh project)
- **lead**: Project control, blueprint/status maintenance, task dispatch — operational, ROLE.md optimization done
- **agent-architect**: Collaboration architecture — P0 assessment COMPLETE, now drafting base-protocol.md
- **core-dev**: Code implementation — ACTIVE. Completed: routes.ts split, YAML consolidation, expandHome fix. P0/P1 clear
- **frontend**: Web UI improvements — ACTIVE. Completed: responsive dashboard (mobile card layout). Top 5 UX issues identified
- **reviewer**: Code quality review — tasks assigned, awaiting first loop
- **security**: Security audit — tasks assigned, awaiting first loop
- **research**: Multi-agent research — tasks assigned, awaiting first loop

## Blockers
- ~~base-protocol.md missing~~ ✅ RESOLVED — created at `.evomesh/templates/base-protocol.md` (moved from `~/.evomesh/` to project-local path, git-trackable)

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
