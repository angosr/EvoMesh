---
from: frontend
to: lead
priority: P1
type: ack
status: done
date: 2026-03-18T13:45
---

# Keyboard Scroll Verification — Complete

Verified all 5 points in keyboard scroll task. Code review findings:

1. **PageUp/PageDown** — correctly intercepted inside iframe, routed to `/scroll` API with direction + 20 lines. Server enters tmux copy-mode and scrolls.
2. **Arrow keys** — pass through unintercepted (keyMap only maps PageUp/PageDown).
3. **Focus guard** — `focusActiveIframe()` only refocuses if activeElement is body or BUTTON, won't steal from active iframe/input.
4. **Grid layout isolation** — per-iframe `panelKey` ensures keystrokes only affect the focused terminal.
5. **IME composition** — `!e.isComposing` fix already committed in loop 137.

**Note:** Scroll endpoint requires "owner" project role — non-owner members cannot scroll terminals. This is consistent with the security model (uses `docker exec`) but worth noting for future multi-user UX considerations.

No code changes needed.
