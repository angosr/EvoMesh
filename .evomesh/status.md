# EvoMesh — Project Status

> Maintained by Lead role. All roles read-only. Updated each loop.
> Last updated: 2026-03-16T22:10

## Current Progress
- Docker container backend: operational
- Web UI: functional (dashboard, terminals, settings, auth)
- Central AI: Phase 1 implemented (container, ROLE.md, status/notification panel)
- Role templates: base-protocol.md created at `.evomesh/templates/base-protocol.md` ✅
- Auth: password-based login with multi-user support
- Security: XSS fix (inline onclick → addEventListener) and shell injection fix applied ✅
- Registry closed-loop architecture: DECIDED (see shared/decisions.md)

## Active Roles (EvoMesh project)
- **lead**: Operational — all P0 complete, processing user directives, dispatching tasks
- **agent-architect**: P0 assessment done. Heartbeat proposal accepted as Phase 2. Reviewing closed-loop design
- **core-dev**: ACTIVE — P0/P1 clear from prior work. NEW P0: registry.json + mission control API dispatched
- **frontend**: ACTIVE — responsive dashboard done. NEW P0: Mission Control panel UI dispatched
- **reviewer**: ACTIVE — first review cycle COMPLETE (4 P0, 3 P1, 4 P2 findings). 2 P0s already fixed
- **security**: Tasks assigned, awaiting first loop
- **research**: Tasks assigned, awaiting first loop

## Current P0 Work Items
1. **registry.json closed-loop** → core-dev (Server 15-sec scan + atomic write)
2. **Mission Control panel** → core-dev (API) + frontend (UI)
3. **Remaining reviewer P0s** → core-dev (HOME mount over-exposure, SSE auth bypass)

## Blockers
- ~~base-protocol.md missing~~ ✅ RESOLVED
- Mission Control frontend blocked on core-dev implementing `/api/mission-control` API first

## Known Issues
- Mobile terminal scrolling uses API-based approach (not silky smooth)
- Reviewer P0-2: Central AI mounts entire HOME directory read-write (security risk)
- Reviewer P0-3: SSH keys mounted into role containers (acceptable for git, but risk noted)
- Reviewer P0-4: SSE refresh endpoint has no auth check
- Port allocation race condition (P1-2)

## Risks
- System complexity growing fast — registry + mission control adds significant new surface area
- 3 of 7 roles (security, research, agent-architect) not yet in active loop cycles
