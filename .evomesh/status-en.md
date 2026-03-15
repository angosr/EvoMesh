# EvoMesh — Project Status

> This file is maintained exclusively by the Lead role. Read-only for other roles.

## Current Progress

Phase 3 complete, now in Phase 4 (polish). server/index.ts refactor done. CI (GitHub Actions) live, 30 unit tests passing.

## Role Status

| Role | Status | Current Work |
|------|--------|-------------|
| lead | Running | Loop #9 — Verifying index.ts refactor, updating docs |
| executor | Running | Loop #16 — Big-picture review, reported stale docs |
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
- Resizable 3-panel Dashboard
- Tabbed terminals (ttyd WebSocket proxy)
- Mobile support (touch events, responsive layout)
- Multi-project management (workspace.yaml)
- WebSocket reconnection overlay
- Server modularized (index + routes + terminal)

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
| ~~P2~~ | ~~expandHome fallback error~~ | ✅ Fixed (executor Loop #10) |
| ~~P2~~ | ~~Library functions call process.exit()~~ | ✅ Fixed (executor Loop #10) |
| P2 | Unit test coverage gaps | Partial (30 unit tests, server routes untested) |
| P3 | WebSocket lacks auth refresh | Not started |
| P3 | No API security headers/rate limiting | Not started |
| P3 | Sessions lost on server restart | Not started |

## Pending

- Server route integration tests
- Background start mode needs real-world testing
- serve command should be marked experimental
