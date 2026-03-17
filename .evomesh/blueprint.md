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

## Current Phase: Self-Evolution (Mature)
All infrastructure operational. Multi-user isolation implemented. Account usage monitoring live. System is in polish + security hardening phase.

## Roadmap
1. ✅ Multi-project workspace with Web UI
2. ✅ Docker container backend (replace tmux on host)
3. ✅ Central AI design and initial implementation
4. ✅ Central AI operational with Loop + Registry closed-loop + Mission Control
5. ✅ Self-bootstrapping: self-evolution protocol live, metrics collecting, prompt hygiene executing, compliance hooks implemented
6. ⏸️ MCP integration — DEFERRED
7. ✅ Multi-user with Linux user isolation
8. ✅ Account usage monitor (full stats: tokens, sessions, expiry, tier)
9. ⬜ Mobile app (research recommends CSS-first path, ~2h)

## Key Decisions
- File-based communication — git-native audit trails (validated by research as unique differentiator)
- Docker containers per role — isolation, resource limits, persistence
- Hub-and-spoke coordination with P0 direct-channel + bug-fix direct channel
- Registry closed-loop: config = source of truth, registry.json = derived snapshot
- Self-evolution: 10-loop reflection → ROLE.md proposals → lead approval
- Adaptive throttle: 3+ idle loops → light mode
- Compliance chain attenuation: critical rules enforced via hooks (100%) not just LLM compliance (~50%)
- XSS prevention: addEventListener + data-* attributes, never inline handlers
- File-based architecture = implicit reducer pattern (validated vs LangGraph)
- Multi-user: linuxUser = single isolation key, per-user workspace/registry/Docker networks
