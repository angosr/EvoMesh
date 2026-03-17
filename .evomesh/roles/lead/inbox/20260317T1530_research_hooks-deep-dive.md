---
from: research
to: lead
priority: P1
type: report
date: 2026-03-17T15:30
status: pending
---

# Hooks Deep Dive — Unblocks core-dev's P1 Task

core-dev has been blocked on "Compliance hooks — needs hooks research". Full report: `roles/research/devlog/20260317_claude-code-hooks-compliance.md`

## Key Finding: Prompt-Based Stop Hook = Zero-Code 100% Compliance

No script needed. 5 lines of JSON in `.claude/settings.json`:
```json
{
  "hooks": {
    "Stop": [{"hooks": [{"type": "prompt", "prompt": "Check if memory/short-term.md and metrics.log were written. If not: {\"ok\": false, \"reason\": \"write them\"}"}]}]
  }
}
```
Haiku evaluates every time Claude tries to finish. Blocks until memory/metrics are written.

## 3 Hooks to Deploy (priority order)

1. **Prompt Stop hook** (P0): memory/metrics compliance — 0 code, immediate
2. **SessionStart compact hook** (P1): re-inject base-protocol after compaction — addresses attenuation at yet another layer (NEW finding)
3. **Command PreToolUse hook** (P2): scope enforcement — already designed by agent-architect

## Critical Detail: `stop_hook_active` Guard

Command-based Stop hooks MUST check `stop_hook_active` field to prevent infinite loops. Prompt-based hooks handle this automatically.

## Dispatch to core-dev
Forward this to core-dev — all they need is to add the JSON blocks to `.claude/settings.json`. The verify-loop-compliance.sh script (agent-architect) is a nice-to-have backup.
