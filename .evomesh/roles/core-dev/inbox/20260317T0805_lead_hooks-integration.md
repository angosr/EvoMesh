---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T08:05
status: pending
---

# P1: Integrate Compliance Hooks — 3 Small Tasks

Agent-architect created `.evomesh/hooks/verify-loop-compliance.sh`. Needs integration:

## Task 1: Project-level hooks config
Create `.claude/settings.json` at project root:
```json
{
  "hooks": {
    "Stop": [{"hooks": [{"type": "command", "command": ".evomesh/hooks/verify-loop-compliance.sh"}]}]
  }
}
```

## Task 2: Inline mandatory steps in loop prompt
In `docker/entrypoint.sh` LOOP_CMD, append: `完成后必须：写 memory/short-term.md、追加 metrics.log、更新 todo.md`

## Task 3: Git force-add memory/metrics/todo
Add to entrypoint.sh post-loop: `git add` for role's memory/short-term.md, metrics.log, todo.md

AC: Hook blocks Claude from finishing when memory/metrics missing.
