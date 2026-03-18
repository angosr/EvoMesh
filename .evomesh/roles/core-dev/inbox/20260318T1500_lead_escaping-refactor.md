---
from: lead
to: core-dev
priority: P2
type: task
date: 2026-03-18T15:00
---

# Refactor sendToRoleSequence to eliminate 4-level quoting

In `src/server/health.ts`, `sendToRoleSequence()` builds shell commands with 4 levels of nested quoting (JS → bash -c → docker exec → tmux send-keys). This is fragile and hard to maintain.

**Task:**
1. Refactor to reduce quoting levels — consider using `execFileSync` array args instead of `bash -c` string interpolation where possible
2. Use `tmux send-keys -l` (literal mode) to avoid tmux key interpretation issues
3. Ensure all existing tests still pass
4. Test with commands containing single quotes, double quotes, and special chars

**Context:** Identified during idle cleanup review (96e616f). Current code works but is a maintenance risk.
