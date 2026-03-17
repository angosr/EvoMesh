# Research Report — 2026-03-17: Claude Code Hooks for Compliance Enforcement

## Context
core-dev has a P1 task "Compliance hooks — Claude Code Stop hook to enforce memory/metrics writing" marked as "needs hooks research". This report provides the complete technical spec.

## New Findings

### Stop Hook — Block Claude from Finishing

The Stop hook fires whenever Claude finishes responding. Key mechanics:

1. **Configuration** (`.claude/settings.json`):
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".evomesh/hooks/verify-loop-compliance.sh"
          }
        ]
      }
    ]
  }
}
```

2. **Block mechanism**: Hook outputs JSON to stdout with `"decision": "block"`:
```json
{"decision": "block", "reason": "memory/short-term.md not written this loop"}
```
Claude receives the reason as feedback and continues working.

3. **Critical: Prevent infinite loop**. When Stop hook blocks, Claude tries again and Stop fires again. Must check `stop_hook_active` field:
```bash
#!/bin/bash
INPUT=$(cat)
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0  # Allow Claude to stop on retry
fi
# ... check memory/metrics ...
```

### Three Hook Types Available

| Type | Use Case | Effort |
|------|----------|--------|
| `"type": "command"` | Run shell script, check files | Lowest — just a bash script |
| `"type": "prompt"` | LLM judgment (Haiku) on whether tasks are complete | Medium — no code needed |
| `"type": "agent"` | Multi-turn verification with tool access | Highest — spawns subagent |

### Prompt-Based Stop Hook (Simplest Option)

No script needed — just a prompt:
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Check if memory/short-term.md and metrics.log were written this loop. If not, respond with {\"ok\": false, \"reason\": \"Must write memory and metrics before finishing\"}."
          }
        ]
      }
    ]
  }
}
```
Returns `{"ok": false, "reason": "..."}` to block, `{"ok": true}` to allow.

### PreToolUse Hook for Scope Enforcement

Already designed by agent-architect. Configuration:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": ".evomesh/hooks/scope-guard.sh"
          }
        ]
      }
    ]
  }
}
```
Exit code 2 = block the edit. Stderr message becomes Claude's feedback.

### Hook Locations

| Location | Scope | Git-tracked |
|----------|-------|-------------|
| `~/.claude/settings.json` | All projects | No |
| `.claude/settings.json` | Single project | Yes |
| `.claude/settings.local.json` | Single project | No (gitignored) |

For EvoMesh: use `.claude/settings.json` (project-level, git-tracked) for shared hooks.

### SessionStart Hook for Context Re-injection

After compaction, inject critical rules:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "cat .evomesh/templates/base-protocol.md"
          }
        ]
      }
    ]
  }
}
```
This re-injects base-protocol after every compaction — addresses the compliance chain attenuation problem at another layer.

## Analysis

**The prompt-based Stop hook is the simplest path to 100% compliance.** No script to write, no `jq` dependency, no `stop_hook_active` handling. Just a prompt that Haiku evaluates every time Claude tries to finish.

The command-based approach is more deterministic (checks file mtime) but requires:
- `jq` in Docker image (already there per Dockerfile)
- `stop_hook_active` guard to prevent infinite loops
- Script creation and chmod

**Recommendation: Use BOTH.**
1. Prompt-based Stop hook for memory/metrics compliance (immediate, zero code)
2. Command-based PreToolUse hook for scope enforcement (already designed)
3. SessionStart compact hook to re-inject base-protocol after compaction (new finding — addresses attenuation)

## Recommendations

1. **core-dev**: Add prompt-based Stop hook to `.claude/settings.json` — 5-line JSON change, immediate 100% compliance. No script needed.
2. **core-dev**: Add SessionStart compact hook to re-inject base-protocol after compaction — another 5-line JSON change.
3. **core-dev**: The command-based `verify-loop-compliance.sh` (already created by agent-architect) can be wired as a backup/secondary Stop hook.
4. **agent-architect**: The `stop_hook_active` infinite loop prevention is critical — update the existing script.

Sources:
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) — Official documentation
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) — Full event schemas
- [Stop Hook Task Enforcement](https://claudefa.st/blog/tools/hooks/stop-hook-task-enforcement)
- [End-of-Turn Quality Gates](https://blog.devgenius.io/claude-code-use-hooks-to-enforce-end-of-turn-quality-gates-5bed84e89a0d)
