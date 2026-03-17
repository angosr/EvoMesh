---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T21:00
status: pending
---

# P1: Deploy Compliance Stop Hook

Prompt-based Stop hook was dispatched earlier but may not have been implemented. Verify and deploy.

## Task
Add to `.claude/settings.json` at project root:
```json
{
  "hooks": {
    "Stop": [{"hooks": [{"type": "prompt", "prompt": "Check: were memory/short-term.md and metrics.log written this loop? If not, respond with {\"decision\": \"block\", \"reason\": \"Write memory and metrics before finishing.\"}"}]}]
  }
}
```

Also: P2 batch from earlier if not done — index.ts split (533 lines) + priority fix (routes-admin.ts:147 `high` → `P0`).

AC: Stop hook config exists. Roles blocked from finishing without memory/metrics.
