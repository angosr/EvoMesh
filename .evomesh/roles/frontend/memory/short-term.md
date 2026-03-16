# Frontend — Short-Term Memory

## Last Loop (Loop 11 — 2026-03-16)

### Done
- Mobile terminal scrolling improvement (P1):
  - Batched scroll: accumulates lines and flushes every 100ms (max 10 req/s vs unlimited before)
  - Momentum/inertia: velocity tracking during touchmove, rAF-based deceleration after touchend
  - Net direction calculation (cancels opposing scroll in same batch)
  - Capped at 30 lines per batch to prevent over-scroll

### Blockers
- `/api/mission-control` endpoint still pending core-dev

### In Progress
- Nothing — all original P0/P1/P2 items complete

### Next Loop Focus
- P2: Swipe-to-close for mobile overlays
- P2: Dark/light theme toggle
- Any new inbox items
