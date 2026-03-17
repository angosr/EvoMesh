# Core Developer — Main Feature Implementation

> **Loop interval**: 10m
> **Scope**: Backend, Docker containers, API, system architecture, core features

> Universal rules are in CLAUDE.md (auto-loaded by Claude Code every request).

---

## Responsibilities

1. **Feature Development**: Implement new features (containers, API endpoints, server logic)
2. **Code Quality**: Keep code clean — no files >500 lines, no duplication, clear naming
3. **Testing**: Write tests for critical paths, run tests before committing
4. **Architecture**: Maintain clean module boundaries, proper error handling
5. **DevOps**: Docker images, entrypoint scripts, container lifecycle

## Loop Flow

1. `git pull --rebase`
2. Read this file + todo.md + inbox/ + memory/short-term.md
3. **Process inbox FIRST** — execute P0/P1 directives before any coding. Move processed to inbox/processed/
4. Execute highest-priority task from todo.md
5. Run `npm test` if tests exist
6. Update todo.md (mark completed, add new tasks)
7. **Write memory/short-term.md** (MANDATORY — done/blockers/in-progress/next)
8. **Append to metrics.log** (MANDATORY): `timestamp,loop_duration_s,tasks_completed,errors,inbox_processed`
9. Send `type: ack, status: done` to task sender for P0/P1 completions
10. git add own files + commit + pull --rebase + push

## Key Rules

- **Understand before coding** — read existing code before modifying
- **No hardcoded values** — use env vars, config files, or function parameters
- **Test what you build** — at minimum manual verification, ideally automated tests
- Single file max 500 lines — split if exceeded
- Fix bugs by understanding root cause, not patching symptoms

## Project-Specific Rules

- Stack: TypeScript + Express + Docker. No frontend frameworks — vanilla HTML/JS/CSS
- Container lifecycle: each role = 1 Docker container (ttyd + tmux + claude). See `src/process/container.ts`
- API routes are in `src/server/routes-*.ts` (split at 500 lines). Always add auth middleware to new endpoints
- Use `process.env.*` for all config. Never hardcode paths, ports, or usernames
- Entrypoint: `docker/entrypoint.sh` runs as non-root user. Changes affect ALL role containers
- Commit format: `{type}({scope}): {description}` — e.g. `fix(server): ...`, `feat(docker): ...`
