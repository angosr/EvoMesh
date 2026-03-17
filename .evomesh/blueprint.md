# EvoMesh — Strategic Blueprint

> Maintained by Lead role. All roles read-only. Updated each loop.

## Vision
EvoMesh is a self-evolving multi-role orchestrator. Its core goal: **make human-AI and AI-AI collaboration maximally efficient**.

The system centers around a **Central AI** — the user's super brain — that monitors all projects, coordinates all roles, and eventually achieves self-bootstrapping (the system improves itself).

## Architecture
- **Central AI**: User's interface to everything. Runs in its own container, manages projects via file editing.
- **Roles**: Each runs in a Docker container (ttyd + tmux + claude). Lead, core-dev, frontend, reviewer, security, research, agent-architect.
- **Web UI**: Left=project tree+tabs, Right=Mission Control panel, Main=terminals/dashboard.
- **Registry**: Server writes `~/.evomesh/registry.json` every 15s. Single writer, all others read-only.
- **Templates**: File-based role templates in `.evomesh/templates/`. Used by both Central AI and server smartInit.
- **Protocol**: `base-protocol.md` (11+ sections) governs all role behavior, communication, and self-evolution.

## Current Phase: Self-Evolution
All infrastructure operational. Protocols established. System is self-evolving via metrics, prompt hygiene audits, and lead-approved ROLE.md changes.

## Roadmap
1. ✅ Multi-project workspace with Web UI
2. ✅ Docker container backend (replace tmux on host)
3. ✅ Central AI design and initial implementation
4. ✅ Central AI operational with Loop + Registry closed-loop + Mission Control
5. ✅ Self-bootstrapping: self-evolution protocol live, metrics collecting, prompt hygiene executing, compliance hooks implemented
6. ⏸️ MCP integration — DEFERRED (roles have full shell access; MCP adds abstraction without solving a real problem)
7. ✅ Multi-user with Linux user isolation (all code done + security reviewed)
8. ✅ Account usage monitor (API beb6c3d + UI 359540e)
9. ⬜ Mobile app

## Next Milestone: Item 7 — Multi-User Isolation
Research already completed feasibility study (devlog/20260317_multi-user-isolation-research.md):
- Our Docker-per-role architecture is 80% of the way to multi-user
- Per-user workspace: `~/.evomesh/` already namespaced by Linux user
- Per-user containers: extend naming to `evomesh-{user}-{project}-{role}`
- ACL system already exists (`acl.yaml`, `acl.ts`)
- Docker userns-remap for filesystem isolation
- ttyd supports `--credential` for per-connection auth

**Status**:
- ✅ Design: architecture approved (shared/decisions.md), threat model done (2 P0, 3 P1, 2 P2)
- ✅ Phase 1: per-user workspace + container naming (b6a58a9)
- ✅ Phase 2: scoped projects + Docker network isolation (4073aa6)
- 🔄 Security review of implementation (dispatched)
- 🔄 Frontend UI verification (dispatched)
- ⬜ Remaining P1s: terminal ACL check, useradd privilege helper

## MCP — Deferred (was Item 6)
Agent-architect produced a clean protocol design (project.yaml config, ~5 lines server code).
Protocol archived in lead inbox/processed. Can be reactivated if a concrete need arises.
**Rationale**: Roles run in Docker with full shell/CLI access. `curl`, `gh`, `npm` are already available. MCP solves "no tool access" — a problem EvoMesh doesn't have.

## Key Decisions
- File-based communication — git-native audit trails (validated by research as unique differentiator)
- Docker containers per role — isolation, resource limits, persistence
- Hub-and-spoke coordination with P0 direct-channel + bug-fix direct channel
- Registry closed-loop: config = source of truth, registry.json = derived snapshot
- Self-evolution: metrics.log → 10-loop reflection → ROLE.md proposals → lead approval
- Adaptive throttle: 3+ idle loops → light mode
- Completion acks mandatory for P0/P1 tasks
- No background processes in containers
- Compliance chain attenuation: critical rules enforced via hooks (100%) not just LLM compliance (~50%)
- XSS prevention: addEventListener + data-* attributes, never inline handlers
- File-based architecture = implicit reducer pattern (validated vs LangGraph)
