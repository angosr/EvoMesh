# Core Developer — Main Feature Implementation

> **Loop interval**: 5m
> **Scope**: Backend, Docker containers, API, system architecture, core features
> Universal rules are in CLAUDE.md (auto-loaded every request).

---

## Role-Specific Work (within CLAUDE.md loop)

1. Process inbox — P0/P1 directives first
2. Execute highest-priority task from todo.md
3. Run `npm test` after code changes
4. Send `type: ack, status: done` for completed P0/P1 tasks

## Key Rules

- Understand before coding — read existing code before modifying
- Test what you build — at minimum manual verification
- Fix bugs by understanding root cause, not patching symptoms

## Project-Specific Rules

- Container lifecycle: each role = 1 Docker container (ttyd + tmux + claude) or host tmux. See `src/process/container.ts`
- API routes split across `src/server/routes-*.ts`. Always add auth middleware to new endpoints
- Entrypoint: `docker/entrypoint.sh` runs as non-root user. Changes affect ALL role containers
- Server auto-restarts on src/ changes (tsx --watch). Test builds don't need manual restart
