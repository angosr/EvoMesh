# EvoMesh Base Protocol v3

> Complete protocol reference. CLAUDE.md (auto-loaded) is the execution copy.

---

## 1. Loop Flow

1. `git pull --rebase` (stash on conflict, retry)
2. Read: ROLE.md + todo.md + inbox/ + memory/short-term.md + shared/decisions.md
3. Process inbox (P0 this loop, P1 within 2 loops) → move to inbox/processed/
4. Execute role work
5. Write outputs: memory/short-term.md, metrics.log, heartbeat.json, todo.md
6. `git add <own files only>` → commit → `git pull --rebase` → push

**Idle**: 3× idle → light mode (inbox + memory/metrics only, no git commit/push).

---

## 2. Memory

| File | Purpose | Limit | Git |
|---|---|---|---|
| `memory/short-term.md` | Current loop state | ≤50 lines, overwrite | .gitignore |
| `memory/long-term.md` | Cross-loop knowledge | ≤200 lines, append-only | commit |
| `metrics.log` | Performance CSV | append-only | .gitignore |

**short-term format**:
```
## YYYY-MM-DD Loop N
- **Done**: ...
- **Blockers**: ...
- **In-progress**: ...
- **Next focus**: ...
```

**metrics.log**: `timestamp,duration_s,tasks_done,errors,inbox_processed`

**Archive**: long-term > 200 lines → move oldest to `memory/archive.md`.

---

## 3. Inbox Communication

**Filename**: `YYYYMMDDTHHMM_from_topic.md`

```yaml
---
from: role-name
to: role-name    # "all" = broadcast
priority: P0|P1|P2
type: task|proposal|feedback|report|ack
date: YYYY-MM-DDTHH:MM
---
```

P0 = this loop | P1 = within 2 loops | P2 = within 1 day

P0/P1 done → `type: ack, status: done` to sender.

---

## 4. Coordination Topology

**Hub-and-spoke**: Cross-role communication through lead, except:
- P0 direct (security/stability → relevant role + lead)
- Bug fix direct (reviewer/security → core-dev/frontend, CC lead)
- ack replies → directly to sender

---

## 5. Git & Files

- Commit: `{type}({scope}/{role}): {description}`
- `git add` own files only. **NEVER** `git add -A`, `git add .`
- **Forbidden**: `rm -rf`, `git push --force`, `git reset --hard`, background processes
- File > 500 lines → split
- All committed content English. User-facing replies follow user's language.

---

## 6. Shared Documents

- `blueprint.md` / `status.md`: lead only writes
- `shared/decisions.md`: append-only, never edit existing
- `project.yaml`: Server API only writes

---

## 7. Self-Evolution Protocol

### Prompt Evolution (every 10 loops)
Roles may modify own ROLE.md. Rules serve the work.
- **Remove**: dead rules, redundant/duplicate, contradicted by decisions.md
- **Merge**: overlapping rules into one statement
- **Add**: rules from repeated mistakes or new patterns
- Log to evolution.log with evidence. 🔒 rules = user/lead only.

### Self-Audit (alternating with prompt evolution)
- Quality gate: (a) what problem? cite metrics (b) what behavior changes? (c) how to measure?
- Wording-only changes = skip.

---

## 8. Circuit Breaker

3 consecutive errors → `heartbeat.json` with `circuit-open` → P0 alert to lead → stop working (keep heartbeat) → wait for lead reset.
