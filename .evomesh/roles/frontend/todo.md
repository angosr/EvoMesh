# frontend — Tasks

## P0 — First Loop Setup

1. ~~**Install recommended skills**~~ (deferred — not available in this context)
2. ~~Review current Web UI code~~ ✅ Reviewed: frontend.html, frontend.js, frontend-panels.js, frontend-settings.js, frontend.css
3. **Top 5 UX Issues** (identified):
   - [x] Dashboard table not responsive on mobile — fixed: stacked card layout
   - [ ] Mobile terminal scrolling choppy — touch scroll uses API-based workaround with fixed WHEEL_DELTA=80, no momentum/inertia
   - [ ] Settings page: add-user form is cramped on mobile — partially fixed with flex-direction column
   - [ ] Copy dialog (long-press) on mobile — uses `prompt()`-style modal, hard to select text on touch
   - [ ] No visual feedback when actions are in progress (restart, delete, add project) — buttons don't show loading state

## P1 — Current Issues

- [x] Mission Control panel — scaffolded with 4 tabs (Activity, Issues, Tasks, Central AI)
  - Activity: auto-renders from project/role state (fallback until API exists)
  - Issues: auto-detects login-needed and stopped roles with action buttons
  - Tasks: placeholder waiting for `/api/mission-control` endpoint
  - Central AI: compact status + feed, command input always visible
- [ ] Mobile terminal scrolling not smooth (API-based workaround with fixed step sizes)
- [x] Dashboard table more responsive — done: card layout on mobile
- [x] XSS risk in inline onclick handlers — fixed: replaced with addEventListener + data-* attributes
- [ ] Touch scroll layer approach vs tmux mouse tradeoff
- [ ] Settings page needs polish (partially addressed in mobile CSS)

## P2 — Improvements

- [ ] Add loading spinners/disabled state to action buttons during async operations
- [ ] Improve copy dialog: use a proper modal with "Copy All" button instead of text selection
- [ ] Add swipe-to-close for mobile sidebar/chat overlays
- [ ] Consider dark/light theme toggle using existing CSS variables
