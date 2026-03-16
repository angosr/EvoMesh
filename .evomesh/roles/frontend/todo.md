# frontend — Tasks

## Completed
- [x] Dashboard table responsive on mobile (stacked card layout)
- [x] XSS fix: inline onclick → addEventListener + data-* attributes
- [x] Mission Control panel: 4-tab layout (Activity, Issues, Tasks, Central AI)
- [x] Mission Control API consumption (sort, type mapping, fallback)
- [x] Mobile Mission Control: full-screen, touch-friendly, keyboard-safe
- [x] Loading state for action buttons (withLoading helper)
- [x] Settings page: loading state on password/user buttons, confirm shadowing fix
- [x] Copy dialog: proper modal with "Copy All" button, CSS classes, no inline handlers
- [x] Smoke test suite (15 tests: syntax, XSS, HTML integrity, CSS, function refs)

## P1 — Current Issues
- [ ] Mobile terminal scrolling not smooth (API-based workaround with fixed step sizes)
- [ ] Touch scroll layer approach vs tmux mouse tradeoff
- [ ] `/api/mission-control` endpoint pending core-dev — Tasks tab uses placeholder

## P2 — Improvements
- [ ] Add swipe-to-close for mobile sidebar/chat overlays
- [ ] Consider dark/light theme toggle using existing CSS variables
