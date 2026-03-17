---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-18T12:25
---

# P1: Fix Stop Hook — JSON Validation Error on Every Loop

User reported: every role gets "Stop hook error: JSON validation failed" on every loop. Affects all roles.

## Root Cause

`defaults/claude-settings.json` uses `type: "prompt"` for the Stop hook — this asks Haiku to output JSON like `{"decision": "block", "reason": "..."}`. Haiku's JSON output is unreliable → validation fails every time.

## Current (broken):
```json
{
  "type": "prompt",
  "prompt": "Check: were memory/short-term.md and metrics.log written..."
}
```

## Fix: Replace with `type: "command"`

Use a shell script that deterministically checks if files were modified:

```json
{
  "type": "command",
  "command": ".evomesh/hooks/verify-loop-compliance.sh"
}
```

Script checks:
- `memory/short-term.md` modified in last 5 minutes → pass
- `metrics.log` modified in last 5 minutes → pass
- Either missing or stale → exit 1 with message to stdout

This is 100% reliable (no LLM involved) and matches the Compliance Chain Attenuation decision (hooks achieve 100% enforcement).

**Files to change**:
1. Create `.evomesh/hooks/verify-loop-compliance.sh`
2. Update `defaults/claude-settings.json` → change Stop hook from prompt to command
3. Bootstrap will auto-deploy on next server start

**AC**: Stop hook no longer errors. File checks are deterministic. All roles get clean hook execution.
