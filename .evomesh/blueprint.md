# EvoMesh — Strategic Blueprint

> Maintained by Lead role. All roles read-only. Updated each loop.

## Vision
EvoMesh is a self-evolving multi-role orchestrator. Its core goal: **make human-AI and AI-AI collaboration maximally efficient**.

The system centers around a **Central AI** — the user's super brain — that monitors all projects, coordinates all roles, and eventually achieves self-bootstrapping (the system improves itself).

## Architecture
- **Central AI**: User's interface to everything. Runs in its own container, has full HOME access.
- **Roles**: Each runs in a Docker container (ttyd + tmux + claude). Lead, Executor, Reviewer, etc.
- **Web UI**: Visualization layer. Left=project tree+tabs, Right=Mission Control panel, Main=terminals/dashboard.
- **Registry**: Server writes `~/.evomesh/registry.json` every 15s (runtime snapshot). Single writer, all others read-only.
- **Templates**: Document-based role templates in `.evomesh/templates/`. Central AI references them to create new roles.

## Current Phase: Foundation → Collaboration
Core infrastructure (Docker, Central AI, Web UI) is operational. Now establishing shared protocols and enabling multi-role collaboration.

## Roadmap
1. ✅ Multi-project workspace with Web UI
2. ✅ Docker container backend (replace tmux on host)
3. ✅ Central AI design and initial implementation
4. 🔄 Central AI fully operational with Loop
4a. 🔄 Registry closed-loop (Server → registry.json → Central AI/Web UI)
4b. 🔄 Mission Control panel (replace static Central AI status)
5. ⬜ Self-bootstrapping: roles collaborate to improve the system
6. ⬜ MCP standard protocol integration
7. ⬜ Multi-user with Linux user isolation
8. ⬜ Mobile app

## Key Decisions
- File-based communication (inbox/, todo.md) — simple, git-trackable, no extra infrastructure
- Docker containers per role — isolation, resource limits, persistence
- tmux inside container — process survives browser disconnect
- Central AI as hub — all operations through natural language
- Hub-and-spoke coordination (lead as single coordinator) with P0 direct-channel exception
- Inbox filename standard: `YYYYMMDDTHHMM_from_topic.md` (ISO 8601 T separator)
- Memory lifecycle: short-term (50 lines, per-loop) + long-term (200 lines, append-only) + archive
- Registry closed-loop: config files (workspace.yaml, project.yaml) = source of truth; registry.json = derived snapshot; Server = only writer
- Mission Control replaces static Central AI panel — Server aggregates data directly
