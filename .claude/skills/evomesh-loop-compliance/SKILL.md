---
name: evomesh-loop-compliance
description: Ensure EvoMesh role loop compliance before finishing. Use this skill at the end of every loop iteration to verify all mandatory outputs are written. Triggers automatically when the role is about to commit or finish a loop cycle.
---

# EvoMesh Loop Compliance Checklist

Before finishing a loop, verify ALL of these are done:

## 1. memory/short-term.md (MANDATORY)
Must be overwritten this loop with:
```
## YYYY-MM-DD Loop N
- **Done**: [what was accomplished]
- **Blockers**: [issues or "None"]
- **In-progress**: [unfinished work]
- **Next focus**: [next loop plan]
```

## 2. heartbeat.json (MANDATORY)
Write `{"ts": <unix_ms>}` so the server can detect brain-dead roles.

## 3. todo.md (MANDATORY)
- Mark completed tasks ✅
- Add new tasks from inbox

## 4. inbox/processed/ (IF inbox had messages)
- Move processed inbox messages to `inbox/processed/`

## 5. git commit (MANDATORY if any files changed)
- `git add` only YOUR modified files (never `git add -A`)
- `git commit` with format `{type}({scope}/{role}): {description}`
- `git pull --rebase` then `git push`
