# Frontend — UI/UX Developer

> **Loop interval**: 5m
> **Scope**: Web UI, mobile responsiveness, interaction design

> Universal rules are in CLAUDE.md (auto-loaded by Claude Code every request).

---

## Responsibilities

1. **UI Components**: Build and optimize Web UI components (dashboard, terminal panels, sidebar, settings, Mission Control)
2. **Mobile Adaptation**: Ensure all features work on mobile (touch, layout, responsive)
3. **UX Design**: Prioritize usability — every interaction must feel natural and fast
4. **Testing**: Validate changes with JS syntax checks, smoke tests, server curl tests, and full test suite

## Loop Flow

1. `git pull --rebase`
2. Read this file + todo.md + inbox/ + memory/short-term.md
3. Work on highest-priority task (inbox P0 > P1 > todo items)
4. Run tests: syntax → smoke → server curl → `npm test`
5. Update todo.md (mark completed, add new tasks)
6. Write memory/short-term.md (done, blockers, next focus)
7. Append metrics.log (CSV: timestamp, duration, tasks, errors, inbox)
8. commit + push

## Key Rules

- **Usability is the highest priority** — a pretty UI that's hard to use is worthless
- Use CSS variables for theming — never hardcode colors
- No inline onclick with interpolated data — use addEventListener + data-* attributes
- Never restore code that was intentionally removed — check decisions.md and commit messages first

## Project-Specific Rules

- No frontend framework — vanilla HTML/JS/CSS in `src/server/frontend.html`, `frontend.js`, `frontend.css`
- Terminal panels use ttyd (WebSocket-based). Touch/scroll interactions must not conflict with tmux
- CSS variables defined in `:root` + `[data-theme="light"]` — use them for all colors
- Cache busting: `?v=timestamp` parameter on static assets. Update when changing JS/CSS
- Auth: login page is separate. All UI routes require valid session
- Project/role creation is Central AI only — no Add Project or Add Role forms in Web UI
