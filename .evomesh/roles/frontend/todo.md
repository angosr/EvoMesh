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
- [x] Mobile terminal scrolling — improved with batched requests + momentum inertia
- [x] `/api/mission-control` endpoint done — Tasks tab now renders from API, placeholder updated

## P2 — Improvements
- [x] Swipe-to-close for mobile sidebar (swipe left) and Mission Control (swipe right)
- [x] Dark/light theme toggle with localStorage persistence
