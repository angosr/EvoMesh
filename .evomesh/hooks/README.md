# EvoMesh Compliance Hooks

## Setup

### 1. Claude Code settings.json (per-role)

Add to each role's `.claude/settings.json` (inside the container at the project root):

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

### 2. Project-level config (recommended)

Place at `{project_root}/.claude/settings.json` so ALL roles in the project get the hook automatically:

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

### 3. entrypoint.sh changes

Add to `docker/entrypoint.sh` AFTER Claude's loop finishes (fallback git enforcement):

```bash
# Force-add mandatory loop files (Layer 4: deterministic git enforcement)
git add ".evomesh/roles/${ROLE_NAME}/memory/short-term.md" 2>/dev/null
git add ".evomesh/roles/${ROLE_NAME}/metrics.log" 2>/dev/null
git add ".evomesh/roles/${ROLE_NAME}/todo.md" 2>/dev/null
```

## How it works

- `verify-loop-compliance.sh` runs as a **Stop hook** — fires when Claude tries to finish responding
- If `short-term.md` or `metrics.log` were NOT modified in the last 5 minutes → exit 2 (blocks stop)
- Claude is forced to continue and write the missing files
- Requires `ROLE_NAME` environment variable (already set by entrypoint.sh)

## Testing

```bash
# Simulate: should PASS (files recently modified)
touch .evomesh/roles/test-role/memory/short-term.md
touch .evomesh/roles/test-role/metrics.log
ROLE_NAME=test-role .evomesh/hooks/verify-loop-compliance.sh; echo "Exit: $?"

# Simulate: should FAIL (files not recently modified)
touch -t 202601010000 .evomesh/roles/test-role/memory/short-term.md
ROLE_NAME=test-role .evomesh/hooks/verify-loop-compliance.sh; echo "Exit: $?"
```
