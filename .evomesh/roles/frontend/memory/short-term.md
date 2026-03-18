## Done
- Fixed focus-stealing bug: terminal iframe.focus() was called without checking
  if user is typing in feed textarea or compose dialog. Two call sites fixed:
  - switchTo() in frontend-panels.js — added activeElement guard
  - focusActiveIframe() in frontend.js — added _composeOpen early return

## Blockers
(None)

## In-progress
(None)

## Next focus
- UX/Product audit cycle (next idle)
- P2: migrate inline onclick handlers to addEventListener (needs lead approval)
