# EvoMesh Base Protocol

> All roles MUST follow this protocol. It defines shared conventions for communication, memory, commits, and conflict resolution.

---

## 1. Inbox Communication Protocol

### Message Format

Every inbox message is a Markdown file with YAML frontmatter:

```yaml
---
from: role-name
to: role-name          # or "all" for broadcast
priority: P0|P1|P2
type: task|proposal|feedback|report|ack
date: YYYY-MM-DDTHH:MM
thread-id: optional     # links related messages (use first message filename as thread-id)
ref: optional-filename  # references another message
status: pending|accepted|rejected|done
---

# Title

## Content
```

### Filename Convention

`YYYYMMDDTHHMM_from_topic.md`

Example: `20260316T2100_agent-architect_collaboration-improvements.md`

### Rules

- Always include `from`, `to`, `priority`, `type`, `date` fields
- Use ISO 8601 T separator in filenames and dates (not underscore)
- Broadcast messages (`to: all`): place in sender's outbox or each recipient's inbox
- Acknowledge receipt of P0 messages within 1 loop
- Include `thread-id` when replying to or continuing a conversation

### Priority Definitions

| Priority | Meaning | Response Time |
|----------|---------|--------------|
| P0 | Critical — security, crash, data loss | Next loop |
| P1 | Important — bugs, logic errors, blockers | Within 2 loops |
| P2 | Normal — improvements, suggestions | Within 1 day |

### P0 Direct Channel Exception

For P0 security/stability issues: send directly to the relevant role's inbox AND to lead simultaneously. Do not wait for lead to relay.

---

## 2. Memory Lifecycle

Each role has two memory files:
- `memory/short-term.md` — current loop context
- `memory/long-term.md` — persistent knowledge

### Short-Term Memory (max 50 lines)

Written every loop. Contains:
- What was done this loop
- Active blockers
- In-progress work state
- Cleared/overwritten each loop

### Long-Term Memory (max 200 lines)

Append-only. Contains:
- Learned patterns and decisions
- Resolved issues and their solutions
- Role-specific knowledge that persists across loops

### Archive Trigger

- When short-term > 50 lines → summarize key items to long-term, then clear
- When long-term > 200 lines → move oldest entries to `memory/archive.md`

### Required Per Loop (ENFORCED)

Every role MUST write `memory/short-term.md` every loop. No exceptions.
A role with empty short-term memory is considered non-functional.

Required content:
1. What was done this loop
2. Any blockers encountered
3. In-progress work state
4. Next loop focus

---

## 3. Commit Conventions

### Format

```
{type}({scope}): {description}
```

### Types

| Type | Use |
|------|-----|
| feat | New feature |
| fix | Bug fix |
| refactor | Code restructuring (no behavior change) |
| docs | Documentation only |
| test | Adding/fixing tests |
| chore | Build, config, tooling |
| lead | Lead loop actions (strategic docs, task dispatch) |

### Scope

The area affected: `server`, `docker`, `frontend`, `roles`, `templates`, etc.

### Rules

- One logical change per commit
- Description in imperative mood ("add X", not "added X")
- Keep description under 72 characters
- Body (optional) explains why, not what

---

## 4. Loop Flow (Universal — MANDATORY)

Every role MUST follow this exact loop. Skipping any step is a protocol violation.

1. `git pull --rebase` (stash if needed)
2. Read own ROLE.md + todo.md + inbox/ + **memory/short-term.md** (restore previous loop context)
3. Process inbox: acknowledge P0 messages, read tasks/feedback
4. Execute role-specific work
5. **Write `memory/short-term.md`** (MANDATORY, overwrite each loop):
   ```
   ## YYYY-MM-DD Loop N
   - **Done**: [bullet list of what was accomplished]
   - **Blockers**: [any issues encountered, or "None"]
   - **In-progress**: [work started but not finished]
   - **Next focus**: [what to do next loop]
   ```
6. Update todo.md (mark completed ✅, add new tasks from inbox)
7. `git add` + `git commit` + `git push`

**If you have nothing to do**: write that in short-term memory ("No pending tasks, idle"). Do NOT leave memory empty.

---

## 5. Conflict Resolution

### File Conflicts

- If `git pull --rebase` has conflicts: resolve conservatively (keep both changes if possible)
- Never force-push. Never `git reset --hard`
- If unsure: stash your changes, pull, then re-apply manually

### Decision Conflicts

- If two roles disagree: escalate to lead via inbox
- Lead's decision is final and recorded in `shared/decisions.md`
- All roles can propose reversals via inbox with evidence

### Shared Document Rules

- `blueprint.md` and `status.md`: only lead writes, all others read-only
- `shared/decisions.md`: lead writes decisions, any role can propose via inbox
- `shared/blockers.md`: any role can write their own blockers

---

## 6. Coordination Topology

**Hub-and-spoke**: Lead is the coordinator. All cross-role communication goes through lead's inbox, except:

- **P0 direct channel**: P0 security/stability issues go directly to the relevant role AND lead
- **Bug fix direct channel**: reviewer/security → core-dev/frontend for specific, actionable bug fixes (CC lead)
- **Acknowledgments**: `type: ack` messages can go directly to the sender

---

## 7. File and Code Rules

- No hardcoded values (usernames, paths, ports) — use env vars or config
- No `rm -rf`, `git push --force`, `git reset --hard`
- No file > 500 lines — split if exceeded
- Read existing code before modifying
