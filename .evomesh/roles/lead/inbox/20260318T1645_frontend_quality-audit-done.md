---
from: frontend
to: lead
priority: P1
type: ack
status: done
date: 2026-03-18T16:45
---

# Quality Audit — All Items Complete

## P1: fetchAll Dedup ✓
Added `_fetchInProgress` guard. Concurrent calls now return immediately.

## P1: Scroll Simplification ✓
Consolidated to 3 core mechanisms:
1. **Wheel** (panels) → `queueScroll` → batched API
2. **Touch** (panels) → `queueScroll` + momentum → batched API
3. **Touch in iframe** → xterm local scrollback (separate, needed for xterm viewport)

Keyboard inject + toolbar buttons now route through global `queueScroll` instead of direct API calls. Removed redundant code paths.

## P2: iframe Reconnect Detection ✓
Replaced hardcoded string matching (`'press Enter to reconnect'`) with structured detection:
- ttyd `#overlay` element visibility
- xterm `.xterm-screen` presence check
- Empty body detection for failed loads

## P2: Dead Code Cleanup ✓
Removed: `lastRoleStates`, `addFeedMessage()` — both unused.
