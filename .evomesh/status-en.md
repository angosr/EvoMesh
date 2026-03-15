# EvoMesh — Project Status

> This file is maintained exclusively by the Lead role. Read-only for other roles.

## Current Progress

Phase 4 (polish) in progress. All code refactoring complete (server + frontend split). Settings panel, mobile touch scroll implemented. CI live, 30 unit tests passing. Auth integration tests in progress.

## Role Status

| Role | Status | Current Work |
|------|--------|-------------|
| lead | Running | Loop #12 — Syncing English docs, self-review |
| executor | Running | Loop #21 — Idle, auth integration tests in progress |
| reviewer | **Removed** | User decision, review duties assumed by lead |

## Implemented Features

### Core System
- CLI with 7 commands: init, role (create/list/delete), start, stop, status, attach, serve
- 3 role templates (Chinese + English): lead, executor, reviewer
- tmux process management + PID tracking
- Multi-account support (CLAUDE_CONFIG_DIR)
- Claude Code session auto-resume (--name + session ID)

### Collaboration System
- Inbox messaging
- Self-review protocol
- Cross-role review (Lead)
- Shared documents (decisions.md, blockers.md)

### Web UI
- Express server (port 8080)
- Password authentication (PBKDF2-SHA512) + login page
- Multi-user management (admin/viewer roles, full CRUD)
- Settings panel (profile, password change, user management, system info)
- Resizable 3-panel Dashboard
- Tabbed terminals (ttyd WebSocket proxy)
- Mobile support (touch events, tmux touch-to-scroll, responsive layout)
- Multi-project management (workspace.yaml)
- WebSocket reconnection overlay
- Server modularized (index + routes + terminal)
- Frontend split (HTML + CSS + JS)

### Security
- Command injection fix (spawner.ts, execSync)
- PBKDF2-SHA512 password hashing (100,000 iterations)
- Role-based access control (viewer = read-only)

### Quality
- CI: GitHub Actions (tsc + test on push/PR)
- 30 unit tests (utils/config/registry/manager)
- CLI startup optimization (dist → tsx fallback)

## Known Issues

| Priority | Issue | Status |
|----------|-------|--------|
| P2 | readYaml lacks runtime validation | Not started (low risk) |
| ~~P2~~ | ~~expandHome fallback error~~ | ✅ Fixed |
| ~~P2~~ | ~~Library functions call process.exit()~~ | ✅ Fixed |
| P2 | Server route test coverage | In progress (auth.test.ts) |
| P3 | WebSocket lacks auth refresh | Not started |
| P3 | No API security headers/rate limiting | Not started |
| P3 | Sessions lost on server restart | Not started |

## Pending

- Background start mode needs real-world testing
- serve command should be marked experimental
