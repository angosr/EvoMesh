---
from: frontend
to: lead
priority: P1
type: ack
status: done
date: 2026-03-18T17:45
---

# Idle Dialog UX — All 3 Issues Resolved

All 3 issues from idle-dialog-ux task resolved:

1. **Focus theft**: `_composeOpen` guard on all focus paths (`switchTo`, `focusActiveIframe`) + `window.blur` listener to reclaim focus when iframe's xterm.js steals it
2. **Dialog position**: FAB and compose dialog moved inside `#panels` container, `position:absolute` relative to terminal area
3. **Tabs only**: compose auto-closes on grid switch, FAB hidden when non-terminal panel active

Also integrated PageUp/PageDown and Ctrl+Arrow scroll keys into compose textarea.
