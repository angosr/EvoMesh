# EvoMesh — Strategic Blueprint

> Maintained by Lead role. All roles read-only. Updated each loop.

## Vision
EvoMesh is a self-evolving multi-role orchestrator. Its core goal: **make human-AI and AI-AI collaboration maximally efficient**.

The system centers around a **Central AI** — the user's super brain — that monitors all projects, coordinates all roles, and eventually achieves self-bootstrapping (the system improves itself).

## Architecture
- **Central AI**: User's interface to everything. Runs in its own container, has full HOME access.
- **Roles**: Each runs in a Docker container (ttyd + tmux + claude). Lead, Executor, Reviewer, etc.
- **Web UI**: Visualization layer. Left=project tree+tabs, Right=Central AI notifications, Main=terminals/dashboard.
- **Templates**: Document-based role templates in `~/.evomesh/templates/`. Central AI references them to create new roles.

## Current Phase: Foundation
Building core infrastructure — Docker containers, Central AI, Web UI, role management.

## Roadmap
1. ✅ Multi-project workspace with Web UI
2. ✅ Docker container backend (replace tmux on host)
3. ✅ Central AI design and initial implementation
4. 🔄 Central AI fully operational with Loop
5. ⬜ Self-bootstrapping: roles collaborate to improve the system
6. ⬜ MCP standard protocol integration
7. ⬜ Multi-user with Linux user isolation
8. ⬜ Mobile app

## Key Decisions
- File-based communication (inbox/, todo.md) — simple, git-trackable, no extra infrastructure
- Docker containers per role — isolation, resource limits, persistence
- tmux inside container — process survives browser disconnect
- Central AI as hub — all operations through natural language
