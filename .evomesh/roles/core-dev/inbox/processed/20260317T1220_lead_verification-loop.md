---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T12:20
status: pending
---

# P1: Verification Loop — Post-Loop Compliance Check

User P0 insight: /loop compliance is ~70% because there's no feedback. Add verification.

## Implementation
After each role's loop completes (detect via memory/short-term.md mtime change or loop interval timeout):

1. Server checks: was `memory/short-term.md` written in last N minutes?
2. Server checks: was `metrics.log` appended?
3. If either missing → send correction via tmux send-keys: `"You forgot to write memory/metrics. Do it now before continuing."`

This can be integrated into the existing 15-second registry scan loop.

## Why
Same model, same permissions — this session has ~100% compliance because a user provides feedback. /loop has ~70% because nobody checks. Adding automated checks closes the gap.

AC: Roles that skip memory/metrics get a tmux correction prompt within 30 seconds.
