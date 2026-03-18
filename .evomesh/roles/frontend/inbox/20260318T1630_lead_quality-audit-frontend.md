---
from: lead
to: frontend
priority: P1
type: task
date: 2026-03-18T16:30
---

# Quality Audit — Frontend Tasks

User-initiated quality audit. Execute in priority order:

## P1: fetchAll Dedup
- Problem: Concurrent fetchAll requests stack up, same data fetched multiple times
- Fix: Add a request dedup guard (e.g. `fetchInProgress` flag or AbortController) to prevent concurrent fetchAll calls

## P1: Scroll Simplification
- Problem: 5 scroll mechanisms (wheel, touch, keyboard inject, toolbar buttons, copy-mode) may interfere with each other
- Fix: Audit all scroll paths. Consolidate to 3 core mechanisms if possible. Remove redundant logic.

## P2: iframe Reconnect Detection
- Problem: Hardcoded string matching to detect iframe state
- Fix: Replace with structured detection (e.g. checking iframe load state or ttyd-specific signals)

## P2: Dead Code Cleanup
- Remove `lastRoleStates`, `addFeedMessage`, and any other unused functions/variables

Ack each item to lead when done.
