# Frontend — Long-Term Memory

## Architecture

- **No framework**: vanilla HTML/JS/CSS split across `frontend.html`, `frontend.js`, `frontend-panels.js`, `frontend-settings.js`, `frontend.css`
- **JS globals**: all files share globals from `frontend.js` (state, authFetch, API, esc, etc.)
- **CSS variables**: `:root` for dark theme, `[data-theme="light"]` override. Key vars: `--bg-base`, `--bg-panel`, `--bg-hover`, `--border`, `--text`, `--accent`
- **Cache busting**: `?v=timestamp` on all `<script>` and `<link>` tags in `frontend.html`. Must update on any JS/CSS change
- **Auth**: token from URL param or localStorage, all API calls via `authFetch()`, terminal iframes get `?token=` appended

## Mobile Patterns

- **Sidebar/MC panels**: `position:fixed` overlays on mobile (≤768px), slide in via `transform: translateX`. MC is full-screen (`100vw`/`100dvh`)
- **Swipe-to-close**: sidebar swipe-left, MC swipe-right, 60px threshold, ignores vertical-dominant gestures
- **Touch scroll in terminals**: two mechanisms — `injectTouchScroll` (direct xterm WheelEvent in iframe) and API-based `doScroll` (batched, 100ms flush, momentum via rAF)
- **iOS gotchas**: use `font-size: 16px` on inputs to prevent auto-zoom; `env(safe-area-inset-bottom)` for notched devices; `100dvh` for dynamic viewport height
- **Dashboard table**: stacked card layout on mobile via flex-wrap (not horizontal scroll)

## XSS Prevention

- Never use inline `onclick="..."` with interpolated data (slugs, usernames, paths)
- Pattern: render HTML with `data-*` attributes, then `querySelectorAll('[data-action="..."]').forEach(btn => btn.addEventListener(...))`
- `esc()` function escapes HTML entities but does NOT protect JS attribute context
- Static onclick in HTML (hardcoded function names like `onclick="doLogout()"`) is safe

## UX Decisions

- **Project/role creation**: removed from Web UI — Central AI only (user directive)
- **Mission Control**: 4-tab layout (Activity, Issues, Tasks, Central AI). Activity/Issues built from state as fallback until `/api/mission-control` API lands
- **Loading states**: `withLoading(btn, asyncFn)` helper — disables button, shows "...", re-enables on completion. Applied to restart, password change, add user
- **Copy dialog**: modal with "Copy All" button via `navigator.clipboard.writeText()`, fallback to text selection
- **Theme toggle**: button in Settings > Appearance, persists to `localStorage('evomesh-theme')`

## Testing Strategy

- **JS syntax**: `new Function(code)` validates all 3 frontend JS files
- **Smoke tests**: `test/server/frontend-smoke.test.ts` — 15 tests covering syntax, HTML structure, cache bust consistency, XSS patterns, function reference integrity, CSS integrity
- **Server curl**: start server on temp port, verify all assets HTTP 200, check element counts, verify no deleted code
- **Full suite**: `npm test` — must pass before every commit
- No browser available — cannot do visual/interaction testing

## Common Pitfalls

- Editing `frontend.html` can accidentally remove sections (Add Project, Role Modal were lost in a Mission Control commit)
- Other roles modify frontend files too (simpleMarkdown, terminal auth token) — always check `git diff` on working tree before assuming clean state
- `git pull --rebase` fails with unstaged changes — use `git stash -u` pattern
