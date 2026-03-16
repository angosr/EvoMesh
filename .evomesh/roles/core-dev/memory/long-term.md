# Long-term Memory

## Architecture
- Server: Express on `0.0.0.0:8123` (MUST NOT bind 127.0.0.1 — remote access, see shared/decisions.md)
- Each role = 1 Docker container (ttyd + tmux + claude). Lifecycle in `src/process/container.ts`
- Routes split into routes.ts (<500 lines), routes-roles.ts, routes-admin.ts. Always check file size before adding
- CLI uses `src/process/spawner.ts` (tmux-based, NOT dead code). Server uses container.ts (Docker-based)
- registry.json: Server writes every 15s, Central AI + roles READ ONLY. Includes staleAfterMs hint
- project.yaml owned by Server API + Central AI only. Roles must not modify directly

## Patterns That Work
- Atomic file writes: write to .tmp then fs.renameSync (used in registry.json)
- Port allocation: atomic `_nextPort++` counter in allocatePort() — never scan map inline
- Cookie-based terminal auth: initial ?token= sets HttpOnly cookie, ttyd sub-resources inherit
- Template resolution chain: global ~/.evomesh/templates/ → project .evomesh/templates/ → hardcoded fallback
- Account round-robin: scan ~/.claude* dirs, pick least-loaded, prefer different accounts for lead vs executor

## Gotchas
- Shell injection in sendInput: user input via `sh -c` must use env vars, NOT string interpolation
- SSH keys: mount only known_hosts (ro) + SSH_AUTH_SOCK forwarding, NEVER mount ~/.ssh directory
- Central AI container: scoped mounts only (.evomesh + project dirs), NEVER mount entire HOME
- `/terminal/` paths skip Express auth middleware — terminal.ts handles its own auth via cookie
- `catch (e: any)` → always use `catch (e: unknown)` + `errorMessage()` from utils/error.ts
- Frontend onclick test: DOM methods like `toggle`, `classList` must be in builtins whitelist
- Auto-restart: must mark userStopped on stop API, check flag before restarting to avoid reviving intentionally stopped roles

## Key Files
- `src/server/index.ts` (269 lines): server setup, auth middleware, registry writer, auto-restart
- `src/server/routes.ts` (~460 lines): project CRUD, chat, feed, metrics, mission-control, members
- `src/server/routes-roles.ts` (~145 lines): role lifecycle, CRUD, config, account switching
- `src/server/routes-admin.ts` (~145 lines): central AI management, scroll
- `src/server/terminal.ts` (~150 lines): HTTP/WS proxy with cookie auth
- `src/process/container.ts` (~320 lines): Docker container lifecycle, sendInput, account switching
- `src/workspace/smartInit.ts` (~140 lines): template-based project scaffolding
- `src/utils/error.ts`: shared errorMessage(e: unknown) helper
