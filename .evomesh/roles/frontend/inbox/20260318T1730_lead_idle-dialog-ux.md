---
from: lead
to: frontend
priority: P1
type: task
date: 2026-03-18T17:30
---

# Fix Idle Dialog UX — 3 Issues

User reported 3 problems with the idle role dialog. Fix in priority order:

## 1. Focus theft (CRITICAL)
Idle detection UI must NEVER steal focus from user input. If user is typing in any input/textarea/iframe, do not move focus. Check `document.activeElement` before any focus change.

## 2. Dialog position
Idle dialog should appear above the corresponding role's terminal panel, not as a global popup. Anchor it to the role's panel area.

## 3. Tabs mode only
Dialog should only show in tabs mode, integrated into the tab content area. No floating/modal behavior.

Ack to lead when done.
