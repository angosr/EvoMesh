# EvoMesh Base Protocol

> All roles MUST follow this protocol. It defines shared conventions for communication, memory, commits, and conflict resolution.

---

## 1. Inbox Communication Protocol

### Message Format

Every inbox message is a Markdown file with YAML frontmatter:

```yaml
---
# Required (always include)
from: role-name
to: role-name          # or "all" for broadcast
priority: P0|P1|P2
type: task|proposal|feedback|report|ack
date: YYYY-MM-DDTHH:MM
# Optional (include when relevant)
thread-id: ...         # links related messages (use first message filename)
ref: ...               # references another message
status: pending|accepted|rejected|done
---
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

### Completion Acknowledgment (MANDATORY for P0/P1 tasks)

When you complete a P0 or P1 task received via inbox, send `type: ack, status: done` back to the sender's inbox. Include a one-line summary of what was done. Not required for P2 tasks.

### Recommended Body Structure (guidance, not mandatory)

- **task**: Description + Acceptance Criteria + Context
- **proposal**: Problem + Proposed Solution + Expected Impact + Self-Attack
- **feedback**: Target (file/line) + Issue + Suggested Fix
- **report**: Summary + Findings + Recommendations
- **ack**: Brief acknowledgment, no structure needed

---

## 2. Memory Lifecycle

Each role has two memory files:
- `memory/short-term.md` — current loop context
- `memory/long-term.md` — persistent knowledge

### Short-Term Memory (max 50 lines)

Overwritten each loop. Current context: what was done, blockers, in-progress, next focus. See section 4 step 6 for required format.

### Long-Term Memory (max 200 lines)

Append-only. Learned patterns, resolved issues, role-specific knowledge that persists across loops.

### Archive Trigger

- When short-term > 50 lines → summarize key items to long-term, then clear
- When long-term > 200 lines → move entries older than 7 days to `memory/archive.md`
- When archive.md > 500 lines → summarize oldest 50% into a `## Summary` section at top

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

### Rules

- Scope = area affected: `server`, `docker`, `frontend`, `roles`, `templates`, etc.
- One logical change per commit. Imperative mood. Under 72 chars.

---

## 4. Loop Flow (Universal — MANDATORY)

Every role MUST follow this exact loop. Skipping any step is a protocol violation.

1. `git pull --rebase` (stash if needed)
2. Read own ROLE.md + todo.md + inbox/ + **memory/short-term.md** (restore previous loop context)
3. Read **`shared/decisions.md`** — binding architectural decisions that override local assumptions
4. **Process inbox** (MANDATORY, even on "clean" cycles with no code changes): acknowledge P0 messages, read tasks/feedback, act on directives
5. Execute role-specific work
6. **Write `memory/short-term.md`** (MANDATORY, overwrite each loop):
   ```
   ## YYYY-MM-DD Loop N
   - **Done**: [bullet list of what was accomplished]
   - **Blockers**: [any issues encountered, or "None"]
   - **In-progress**: [work started but not finished]
   - **Next focus**: [what to do next loop]
   ```
7. Update todo.md (mark completed ✅, add new tasks from inbox). For P1+ tasks, include `AC:` acceptance criteria — objectively verifiable completion conditions.
7b. **Append `metrics.log`** (MANDATORY, one CSV line per loop, NOT committed to git):
   `timestamp,loop_duration_s,tasks_completed,errors,inbox_processed`
   Create file with header if it doesn't exist.
8. Git commit and push:
   1. `git add <only your own modified files>` — **NEVER use `git add -A` or `git add .`**
   2. `git commit`
   3. `git pull --rebase` (resolve conflicts if any)
   4. `git push` — if push fails: `git stash && git pull --rebase && git stash pop && git push`

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

### Config File Ownership

- `project.yaml`: **only Server API writes** (via Web UI operations). Roles must NOT edit directly.
- Central AI creating a **new** project: writes a new `project.yaml` in the new project directory (no conflict)
- Central AI modifying an **existing** project's `project.yaml`: must send request to lead via inbox, not edit directly
- `workspace.yaml`: only Server API and Central AI may write

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
- **No long-running background processes** in containers — do not start servers, watchers, or daemons for testing. Use `curl` against existing infrastructure.

---

## 8. Prompt Hygiene

- Every line in ROLE.md must produce **observable behavior change**. If not, delete it.
- Roles self-audit their ROLE.md every 10 loops: remove dead rules, merge duplicates, trim unused conditions.
- base-protocol.md target: <250 lines. Brevity = compliance.

---

## 9. Self-Evolution Protocol

Each role tracks performance and evolves its own prompt:

1. **Measure**: Append one line to `metrics.log` per loop (CSV, `.gitignore`'d):
   `timestamp,loop_duration_s,tasks_completed,errors,inbox_processed`
2. **Reflect**: Every 10 loops, review own ROLE.md against metrics. Ask: "What rules helped? What rules were ignored or counterproductive?"
3. **Propose**: Send ROLE.md change proposal to lead inbox with evidence from metrics.
4. **Apply**: Lead approves/rejects. Approved changes logged in `evolution.log`.

---

## 10. Shared Document Conventions

**Append-only rule**: `shared/decisions.md` and `shared/blockers.md` are append-only. New entries go at the **bottom**. Never edit or delete existing entries. This prevents git merge conflicts on concurrent writes.

**Entry format for decisions.md**:
```markdown
## [{date}] {title}

**决策**: {what was decided}
**原因**: {why}
**提出者**: {role-name}
**状态**: active | superseded-by-{date}
```

**To change a decision**: Add a new entry with `supersedes: [{old-date}] {old-title}`. Mark old entry's status as `superseded-by-{new-date}`. Never edit the old entry directly.

**blockers.md**: Each role appends their own blockers. To resolve, append a resolution entry — do not delete the original.

---

## 11. Circuit Breaker

If **3 consecutive loops** produce errors (exceptions, push failures, inbox processing errors):

1. Write `"status": "circuit-open"` to `heartbeat.json`
2. Send P0 alert to lead inbox: `"Circuit breaker tripped — {error summary}"`
3. Stop executing work. Continue writing heartbeat (idle mode).
4. Wait for reset: lead sends `type: ack, thread-id: circuit-breaker-reset` to inbox.
5. On reset: clear error counter, resume normal operation.
