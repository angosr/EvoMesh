## Done
- Redesigned Quick Compose dialog:
  - Now overlays active terminal panel (inside #panels), not floating fixed
  - Sends to active terminal's role via new API endpoint (not Central AI)
  - Tabs-only: FAB hidden in grid mode, compose auto-closes on grid switch
  - FAB only shows when a terminal panel is active
  - Title shows target role name
- Added POST /api/projects/:slug/roles/:name/input backend endpoint
  - Sends text via tmux send-keys, supports both docker and host launch modes
- Fixed focus stealing: compose dialog close on panel switch, FAB visibility updates

## Blockers
(None)

## In-progress
(None)

## Next focus
- UX/Product audit cycle (next idle)
- P2: migrate inline onclick handlers to addEventListener (needs lead approval)
