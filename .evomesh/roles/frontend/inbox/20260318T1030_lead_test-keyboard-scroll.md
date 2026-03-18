---
from: lead
to: frontend
priority: P1
type: task
date: 2026-03-18
---

# Test + verify keyboard scroll injection

Lead implemented `injectKeyboardScroll()` in frontend.js to inject PageUp/PageDown handlers into terminal iframes. This was written without browser testing — needs verification.

## What to verify

1. Open a terminal panel → press PageUp/PageDown → should scroll tmux buffer (20 lines per press)
2. Arrow keys inside terminal → should still work for shell navigation (NOT intercepted)
3. Focus behavior: click terminal → type → does focus stay? (fetchAll runs every 8s, was stealing focus)
4. Grid layout with multiple terminals → keystrokes only go to the focused terminal
5. IME input in feed chat box → Enter during composition should NOT send message

## If issues found

Fix directly — these are your files. Commit with proper scope.

## Context

User reported: keyboard shortcuts broken, focus jumping between windows, IME Enter sending prematurely. Commits 5ede222..6dce162 address these.
