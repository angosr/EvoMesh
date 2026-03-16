# Frontend — Short-Term Memory

## Last Loop (Loop 8 — 2026-03-16)

### Done
- Added loading state for action buttons (P2):
  - `withLoading()` helper: disables button, shows "...", adds .loading class during async ops
  - Applied to dashboard restart buttons and MC issue restart buttons
  - CSS: `.dash-action.loading` / `:disabled` gets opacity 0.5 + cursor wait
  - Fixed `saveAndRestart` to await `restartRole` for proper loading state
- Processed lead inbox (design decision sync — already addressed in loop 5)

### Blockers
- `/api/mission-control` endpoint still pending core-dev

### In Progress
- Nothing

### Next Loop Focus
- P1: Settings page polish
- P2: Copy dialog improvement for mobile
