# EvoMesh — Universal Rules (auto-loaded every request)

## Loop Flow (MANDATORY)

1. **Lead only**: `git pull --rebase`. Worker roles skip this step.
2. **`cat` and read**: ROLE.md, inbox/*, memory/short-term.md (EVERY loop, do NOT rely on memory)
   Also read (every 5 loops or when notified): blueprint.md, status.md, shared/decisions.md
3. Process inbox (P0 immediately, P1 within 2 loops) → move to inbox/processed/ → `git rm` the original (stages deletion so it survives context clears)
4. **Update claims**: Read `.evomesh/shared/claims.json`. Update your claim:
   - `status`: unclaimed → in-progress → blocked → in-review → completed
   - `lastActivityAt`: current timestamp
   - `notes`: append what you did this loop
   - `blockedReason`: set if blocked (lead will see immediately)
5. Execute role work
6. Write outputs (ALL mandatory, do in one step):
   - `memory/short-term.md` — Done / Blockers / In-progress / Next focus
   - `heartbeat.json` — write `{"ts": <unix_ms>}` (server uses this to detect brain-dead roles)
   - `todo.md` — mark completed, add new
7. If this loop produced real output (code, new dispatches, new decisions): `git add <own files only>` → commit (include bookkeeping files) → push. Lead: `git pull --rebase` before push. Workers: push directly (do NOT pull/stash/rebase — if push fails due to conflict, skip this push and retry next loop).
   If only bookkeeping (heartbeat/memory/todo/inbox processed/status update): write files locally but do NOT commit. They will be included in the next real commit.

Idle? Write "No tasks, idle". 3× idle → light mode (inbox + memory only, no commit).
**Lead NEVER enters light mode.** Light mode exit: any inbox message or lead dispatch.

## Git

- Commit: `{type}({scope}/{role}): {description}`
- **NEVER**: `git add -A`, `git add .`, `rm -rf`, `git push --force`, `git reset --hard`, `git checkout -- .`, `git restore .`, `git stash`
- **NEVER** start background processes
- **Git pull only by lead**: Only the lead role runs `git pull --rebase` (step 1). Worker roles (core-dev, frontend, etc.) do NOT pull — they read files directly from the working tree. This prevents workers from running stash/checkout/restore to resolve conflicts, which can destroy other roles' uncommitted work.
- **Push conflict**: If push fails, skip and retry next loop. If push fails 3 consecutive loops, report blocker to lead inbox. Do NOT force push.
- **NO bookkeeping-only commits**: Do NOT commit if the only changes are: `heartbeat.json`, `memory/short-term.md`, `todo.md`, or updating `status.md`/`blueprint.md` with no new decisions. These are administrative overhead, not deliverables. Only commit when the loop produces **real output**: code changes, new inbox messages dispatched, inbox deletions (`git rm`), new decisions in `shared/decisions.md`, config changes, or documentation with new content. Bundle all bookkeeping files into the next commit that contains real work.
- Code, commit messages, shared/decisions.md, blueprint.md: English.
- `memory/short-term.md`, `todo.md`, inbox messages: follow user's language (these are user-facing via the Feed panel, not technical documentation).
- File > 500 lines → split

## Communication

- Inbox: `YYYYMMDDTHHMM_from_topic.md`, frontmatter: from/to/priority/type/date
- P0/P1 done → `type: ack, status: done` to sender
- Cross-role via lead (except P0 direct + bug fix direct)

## Shared Docs

- blueprint.md / status.md: lead only writes
- shared/decisions.md: append-only
- project.yaml: Server API only writes

## Multi-User Isolation

- Container naming: `evomesh-{linuxUser}-{project}-{role}`
- Each user's workspace: `~{linuxUser}/.evomesh/` (registry, central AI, configs)
- **NEVER** access files outside your user's workspace or project directory

## Self-Evolution Protocol

### Prompt Evolution (every 10 loops)
You may modify your own ROLE.md. Rules serve the work, not the other way around.
- **Remove**: dead/never-triggered rules, redundant/duplicate, contradicted by decisions.md
- **Merge**: overlapping rules into one clear statement
- **Add**: rules learned from repeated mistakes or new patterns
- Also: delete LTM entries that contradict CLAUDE.md, ROLE.md, or decisions.md
- Log every change to evolution.log with evidence. 🔒 rules = user/lead only.
- Evolution log format:
  ```
  [YYYY-MM-DD Loop N] CHANGE: {what changed}
  EVIDENCE: {what problem, metrics, specific incident}
  VERIFY: {how to measure if this helps}
  ```

### Self-Audit (alternating with prompt evolution)
Quality gate: (a) what problem? cite metrics (b) what behavior changes? wording-only = skip (c) how to measure?

### Evolution → Action
Rule changes alone are not improvement. After every evolution cycle:
- If you found a recurring problem, propose a concrete task to lead (not just a rule change).
- If you added a rule, verify it triggers within 5 loops. If not, remove it.

## Code Quality — Anti-Debt Rule

**Same bug fixed 2+ times = mandatory refactor.** Do not add another patch — restructure the code.
- Remove accumulated dead patch code (unused fallbacks, redundant checks, orphaned branches)
- Add tests covering the regression area
- Simplify control flow so the bug class becomes impossible
- Lead dispatches P1 code quality tasks when regression patterns detected in git log
Proposal → lead inbox with metrics evidence → log to evolution.log.

## Context Hygiene

- `memory/short-term.md`: overwrite each loop, max 30 lines. Do not accumulate history.
- `todo.md`: remove completed items older than 5 loops. Stale todos are noise.
- When idle: "No tasks, idle" is sufficient. Do not write lengthy reflections.

## EvoMesh Project-Specific

- TypeScript + Express + Docker. Vanilla HTML/JS/CSS frontend.
- `src/` code, `docker/` containers, `.evomesh/` config, `~/.evomesh/` global
- **All prompt/rule improvements must be reflected in role templates** (`defaults/templates/roles/*.tmpl`) and CLAUDE.md template (`defaults/templates/project-scaffold/CLAUDE.md.tmpl`) so they apply to ALL future projects, not just this one.
- **Understand user intent, not just instructions.** When user requests a change, infer the real need behind it. If the underlying rule is generalizable, proactively add it to the role's ROLE.md and the corresponding template in `defaults/templates/`. Goal: user should never need to repeat the same type of instruction twice.
