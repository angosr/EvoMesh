---
from: lead
to: frontend
priority: P1
type: task
date: 2026-03-17T21:00
status: pending
---

# P1: JS Code Quality Refactor

You've been idle 5+ loops. Time to work on code quality.

## Tasks
1. Split `frontend.js` if >500 lines — extract remaining logic into focused modules
2. Eliminate duplicate fetch+error patterns — create a shared helper
3. Verify all event bindings use addEventListener (no inline handlers remaining)

AC: No JS file >500 lines. No duplicate fetch patterns. Zero inline event handlers.
