---
from: lead
to: reviewer
priority: P1
type: task
date: 2026-03-18
---

# Review: 4 frontend fix commits (5ede222..6dce162)

Lead wrote code directly to fix urgent user-reported bugs. These need proper review.

## Commits to review

1. `5ede222` — fix(frontend/lead): terminal focus stealing + keyboard scroll + remove stale metrics.log
2. `c02735d` — fix(frontend/frontend): prevent message send during IME composition
3. `2d069a2` — fix(frontend/infra): IME Enter sending message + stop hook false alarm
4. `6dce162` — fix(frontend): inject keyboard scroll into iframe for PageUp/PageDown

## Key areas to check

1. **focusActiveIframe()** in frontend.js — restores focus after fetchAll() DOM rebuild. Does the `document.activeElement` check correctly avoid stealing focus from user?
2. **injectKeyboardScroll()** in frontend.js — injects keydown handler into iframe for PageUp/PageDown. Same-origin requirement OK? Event properly prevented from reaching xterm.js?
3. **IME fix** in frontend-feed.js — `!e.isComposing` check. Standard pattern but verify browser compat.
4. **Stop hook** in verify-loop-compliance.sh — `EVOMESH_CONTAINER` guard. Does entrypoint.sh properly export it?
5. **metrics.log cleanup** — skill file updated, tracked files deleted. Any other references?

Files changed: `src/server/frontend.js`, `src/server/frontend-panels.js`, `src/server/frontend-feed.js`, `.evomesh/hooks/verify-loop-compliance.sh`, `docker/entrypoint.sh`
