---
from: user
priority: P1
type: bug
date: 2026-03-17T04:10
---

# Two input/keyboard bugs

## 1. Mobile: wrong button triggered
On mobile, tapping certain buttons (e.g. Start/Stop) sometimes triggers the copy/log dialog instead. Likely a touch event delegation issue — event bubbles up to parent or overlapping elements intercept the tap.

Debug: check if touch targets overlap (padding/margins), especially in the dashboard action buttons area. May need `event.stopPropagation()` or more precise hit targets.

## 2. Host tmux: arrow keys don't work
Central AI runs in host tmux with oh-my-tmux config. Arrow keys (up/down for history, left/right for cursor) don't work in the web terminal.

Root cause: oh-my-tmux rebinds arrow keys. The entrypoint uses `tmux -f /dev/null` for Docker containers (bypasses user config), but host mode uses the user's default tmux config.

Fix options:
- Host mode should also use `tmux -f /dev/null` when creating the session (like Docker entrypoint does)
- Or: `tmux set-option` to reset key bindings after session creation
- This is in `routes-admin.ts` ensureCentralAI and `container.ts` startRoleHost
