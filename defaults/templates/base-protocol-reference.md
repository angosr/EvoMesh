# EvoMesh Base Protocol

> All roles MUST follow this. Brevity = compliance. Every rule has a reason.

---

## 1. Loop Flow

Execute in this order every loop. Do not skip steps.

1. `git pull --rebase` (stash on conflict, retry)
2. Read: ROLE.md + todo.md + inbox/ + memory/short-term.md + shared/decisions.md
3. Process inbox (P0 must be handled this loop. Move processed to inbox/processed/)
4. Execute role work
5. Write `memory/short-term.md` (overwrite, format below)
6. Update todo.md
7. `git add <only your own files>` → commit → `git pull --rebase` → push

**When idle**: write "No tasks, idle". 3 consecutive idle loops → light mode (check inbox + write memory only).

> **Why**: Unified flow makes role state trackable. Memory is the only observation window between roles.

---

## 2. Memory

| File | Purpose | Limit | Git |
|---|---|---|---|
| `memory/short-term.md` | Current loop context | ≤50 lines, overwrite each loop | .gitignore |
| `memory/long-term.md` | Cross-loop knowledge | ≤200 lines, append-only | commit |

**short-term format**:
```
## YYYY-MM-DD Loop N
- **Done**: ...
- **Blockers**: ...
- **In-progress**: ...
- **Next focus**: ...
```

**Archive**: long-term > 200 lines → move oldest entries to `memory/archive.md`.

> **Why**: short-term is the only way other roles and Mission Control observe your state. Empty memory = role offline.

---

## 3. Inbox Communication

**Filename**: `YYYYMMDDTHHMM_from_topic.md`

**Frontmatter** (5 required fields):
```yaml
---
from: role-name
to: role-name    # "all" = broadcast
priority: P0|P1|P2
type: task|proposal|feedback|report|ack
date: YYYY-MM-DDTHH:MM
---
```

**Priority**: P0 = respond next loop | P1 = within 2 loops | P2 = within 1 day

**P0 direct channel**: Security/stability P0 goes directly to relevant role + lead, no relay wait.

**On P0/P1 completion**: send `type: ack, status: done` to the sender.

> **Why**: File communication = git-trackable, no extra infrastructure, offline roles process backlog on restart.

---

## 4. Coordination Topology

**Hub-and-spoke**: Cross-role communication goes through lead, except:
- P0 direct channel (security/stability issues go to relevant role + lead)
- Bug fix direct (reviewer/security → core-dev/frontend, CC lead)
- ack replies go directly to sender

> **Why**: Lead as single coordinator prevents conflicts. Direct exceptions avoid delay on urgent issues.

---

## 5. Git & Files

- Commit format: `{type}({scope}/{role}): {description}`
- `git add` only your own files. **NEVER use `git add -A` or `git add .`**
- **Forbidden**: `rm -rf`, `git push --force`, `git reset --hard`
- Single file > 500 lines must be split
- Read existing code before modifying
- Do not start background processes (servers, watchers, daemons)
- **All committed content must be in English** — code, comments, commit messages, ROLE.md, docs, devlog, inbox. Only user-facing replies may use the user's language.

> **Why**: Multiple roles work in parallel on the same branch. Precise git add prevents overwriting others' changes.

---

## 6. Shared Documents

- `blueprint.md` / `status.md`: only lead may write
- `shared/decisions.md`: **append-only**, new entries at bottom, never edit existing
- `shared/blockers.md`: each role writes own blockers, append resolution when resolved
- `project.yaml`: only Server API may write, roles must not edit directly

> **Why**: Append-only prevents git merge conflicts on concurrent writes. Single writer eliminates ownership disputes.

---

## 7. Self-Evolution

1. Every 10 loops, self-audit your ROLE.md: remove dead rules, merge duplicates, stay concise
2. Send change proposal to lead inbox with metrics evidence
3. Log approved changes to `evolution.log`
4. 🔒 marked rules cannot be changed through self-evolution (only user/lead may change)

> **Why**: Roles continuously optimizing their own prompts = core of system bootstrap. 🔒 rules prevent evolution drift.

---

## 8. Circuit Breaker

3 consecutive loop errors → write `heartbeat.json` with `circuit-open` → send P0 alert to lead → stop working (keep writing heartbeat) → wait for lead reset.

> **Why**: Prevents broken roles from polluting git history and consuming resources.


