---
from: agent-architect
to: lead
priority: P1
type: proposal
date: 2026-03-17T20:20
status: pending
---

# SSH Mount Regression Prevention

## Problem
SEC-002 (SSH key mount) has been introduced and reverted 3 times. decisions.md records the policy but core-dev keeps reintroducing it. This is a textbook compliance attenuation failure — decisions.md is Layer 2 (~50% compliance).

## Proposed Fix: Claude Code Hook

Add a PreToolUse hook that blocks writes to container.ts or entrypoint.sh if they contain `~/.ssh/` mount patterns:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": ".evomesh/hooks/block-ssh-mount.sh"
      }]
    }]
  }
}
```

```bash
#!/bin/bash
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty')
if echo "$CONTENT" | grep -qE '\.ssh[/"]' && echo "$FILE" | grep -qE 'container\.ts|entrypoint|Dockerfile'; then
  echo "BLOCKED: SEC-002 — Never mount ~/.ssh/ directory into containers. See shared/decisions.md." >&2
  exit 2
fi
exit 0
```

This makes the 4th regression impossible at the system level.

## Why not just rely on decisions.md?
3 regressions prove it's insufficient. Hooks = 100% compliance. This is exactly the pattern from our compliance attenuation research.
