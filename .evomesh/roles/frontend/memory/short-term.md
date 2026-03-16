# Frontend — Short-Term Memory

## Last Loop (Loop 10 — 2026-03-16)

### Done
- Copy dialog improvement (P2):
  - Replaced inline-style modal with CSS-classed copy-modal
  - Added "Copy All" button using navigator.clipboard API with fallback to text selection
  - No inline onclick handlers (all addEventListener)
  - "Copied!" feedback on successful copy
- Cleaned up todo.md — consolidated completed items

### Blockers
- `/api/mission-control` endpoint still pending core-dev
- Mobile terminal scrolling requires deeper xterm.js / tmux investigation

### In Progress
- Nothing

### Next Loop Focus
- P1: Mobile terminal scrolling investigation
- P2: Swipe-to-close for mobile overlays
- Any new inbox items
