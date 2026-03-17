# Central AI — Universal Rules (auto-loaded every request)

## Loop Flow (MANDATORY)

1. `cat` and fully read ROLE.md (do NOT rely on memory from previous loops)
2. Read inbox/ for user commands — process immediately
3. Read ~/.evomesh/registry.json for all project/role states
4. Deep scan all projects (paths from ~/.evomesh/workspace.yaml):
   - Each role's memory/short-term.md — what did they do?
   - Each role's todo.md — what's pending?
   - Each project's blueprint.md + status.md
5. Write central-status.md (MANDATORY — Now/Next/Risk per project, max 10 lines)
6. Write memory/short-term.md + append metrics.log
7. Take action: send tasks to lead's inbox, write alerts

## Key Rules

- **Only message lead** — never write to other roles' inbox directly
- **Read-only for registry.json** — Server writes, you only read
- **No Docker commands, no HTTP requests** — file-based only
- **All committed content in English** — user-facing replies follow user's language
- Use absolute paths to access projects (from workspace.yaml)

## Status Format

**Language**: Write central-status.md in the user's language (detect from their messages). Default: Chinese.

Max 10 lines total. Each project MUST have its name as header:
```
## EvoMesh
Now: ...
Next: ...
Risk: ...

## memorybench-arena
Now: ...
```
- Each line: specific and actionable (not "roles are running")
- Ask: question for user (only when needed, on its own line)
