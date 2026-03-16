# Design: Claude Code Hooks for Role Scope Enforcement

## Problem
Roles have `scope` defined in project.yaml (e.g., core-dev: `src/`, `docker/`), but nothing enforces it. A role can accidentally write outside its scope, causing conflicts or stepping on another role's work.

## Solution: PreToolUse Hook

Each role container gets a `PreToolUse` hook that blocks `Edit`/`Write` operations outside the role's declared scope.

### Configuration

Per-role Claude config at `~/.evomesh/role-configs/{project}-{role}/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "/workspace/.evomesh/hooks/scope-guard.sh"
          }
        ]
      }
    ]
  }
}
```

### Hook Script: `scope-guard.sh`

```bash
#!/bin/bash
set -e

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd')

# Read allowed scope from environment variable (set by entrypoint.sh)
# ROLE_SCOPE="src/,docker/,test/"
IFS=',' read -ra ALLOWED <<< "${ROLE_SCOPE:-}"

# Always allow: own role directory, memory, inbox
ROLE_DIR=".evomesh/roles/${ROLE_NAME}"
ALWAYS_ALLOWED=("$ROLE_DIR" ".evomesh/shared/blockers.md")

# Normalize file path to relative
REL_PATH="${FILE_PATH#$CWD/}"

# Check always-allowed paths
for pattern in "${ALWAYS_ALLOWED[@]}"; do
  if [[ "$REL_PATH" == "$pattern"* ]]; then
    exit 0
  fi
done

# Check scope patterns
for pattern in "${ALLOWED[@]}"; do
  if [[ "$REL_PATH" == "$pattern"* ]]; then
    exit 0
  fi
done

# Block
echo "Scope violation: ${ROLE_NAME} cannot write to ${REL_PATH}. Allowed: ${ROLE_SCOPE}" >&2
exit 2
```

### How It Gets Configured

1. **entrypoint.sh** reads role's `scope` from project.yaml → sets `ROLE_SCOPE` env var
2. **Container setup** copies `scope-guard.sh` to `/workspace/.evomesh/hooks/`
3. **Claude config** at role-config dir includes the hook definition

### What Each Role Can Write

| Role | Scope (from project.yaml) | Always Allowed |
|---|---|---|
| lead | .evomesh/blueprint.md, .evomesh/status.md, .evomesh/roles/*/inbox/, docs/ | own dir, shared/blockers.md |
| core-dev | src/, docker/, test/ | own dir, shared/blockers.md |
| frontend | src/server/frontend*, src/server/*.html | own dir, shared/blockers.md |
| reviewer | src/, test/, docs/ (read-only role — rarely writes) | own dir, shared/blockers.md |
| security | src/, docker/ (read-only role — rarely writes) | own dir, shared/blockers.md |
| research | devlog/, docs/ | own dir, shared/blockers.md |
| agent-architect | .evomesh/, docs/ | own dir, shared/blockers.md |

### Special Cases
- **Lead writing other roles' ROLE.md**: Lead's scope includes `.evomesh/roles/*/inbox/`. Should we also allow `.evomesh/roles/*/ROLE.md`? Per ROLE.md: "You can modify any role's ROLE.md". → Yes, add `.evomesh/roles/` to lead's scope.
- **base-protocol.md**: Only lead and agent-architect should write `.evomesh/templates/`. Both have `.evomesh/` in scope.
- **Reviewer/security writing feedback**: They write to OTHER roles' inbox/ dirs. → Add `.evomesh/roles/*/inbox/` to reviewer and security scopes.

### Revised Scopes (with inbox access for reviewer/security)

```yaml
lead:       [".evomesh/", "docs/"]
core-dev:   ["src/", "docker/", "test/"]
frontend:   ["src/server/frontend", "src/server/*.html"]
reviewer:   [".evomesh/roles/*/inbox/", "devlog/"]  # read src, write feedback
security:   [".evomesh/roles/*/inbox/", "devlog/"]  # read src, write findings
research:   ["devlog/", "docs/"]
agent-architect: [".evomesh/", "docs/"]
```

### Implementation Effort
- Hook script: ~20 lines bash (above)
- entrypoint.sh: ~5 lines to parse scope from project.yaml and set env var
- Per-role settings.json: add hooks section (can be templated)
- **Total: ~1 hour core-dev work**

### Self-Attack
**Q: What if a role legitimately needs to write outside scope?**
A: The hook blocks with an error message explaining the scope violation. Role should send a task to the appropriate role via inbox. If scope needs permanent expansion, propose to lead.

**Q: Will this slow down Claude?**
A: Negligible — bash script runs in <10ms per tool call. Only triggers on Edit/Write.

**Q: Can roles circumvent via Bash tool (echo > file)?**
A: Add `Bash` to the matcher: `"matcher": "Edit|Write|Bash"`. For Bash, parse the command for redirect operators (`>`, `>>`, `tee`) targeting out-of-scope paths. More complex but doable. Start with Edit/Write only.
