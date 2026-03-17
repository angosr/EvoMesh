# EvoMesh — Universal Rules (auto-loaded every request)

## Loop Flow (MANDATORY)

1. `git pull --rebase`
2. **`cat` and read**: ROLE.md, inbox/*, memory/short-term.md (EVERY loop, do NOT rely on memory)
   Also read (every 5 loops or when notified): blueprint.md, status.md, shared/decisions.md
3. Process inbox (P0 immediately, P1 within 2 loops) → move to inbox/processed/
4. Execute role work
5. Write outputs (ALL mandatory, do in one step):
   - `memory/short-term.md` — Done / Blockers / In-progress / Next focus
   - `metrics.log` — append CSV: `timestamp,duration_s,tasks_done,errors,inbox_processed`
   - `heartbeat.json` — write `{"ts": <unix_ms>}` (server uses this to detect brain-dead roles)
   - `todo.md` — mark completed, add new
6. `git add <own files only>` → commit → `git pull --rebase` → push

Idle? Write "No tasks, idle". 3× idle → light mode (inbox + memory/metrics only).
**Light mode: do NOT git commit/push.** Only commit when you actually changed code or processed inbox.

## Git

- Commit: `{type}({scope}/{role}): {description}`
- **NEVER**: `git add -A`, `git add .`, `rm -rf`, `git push --force`, `git reset --hard`
- **NEVER** start background processes
- All committed content English. User-facing replies follow user's language.
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

### Self-Audit (alternating with prompt evolution)
Quality gate: (a) what problem? cite metrics (b) what behavior changes? wording-only = skip (c) how to measure?

## Code Quality — Anti-Debt Rule

**Same bug fixed 2+ times = mandatory refactor.** Do not add another patch — restructure the code.
- Remove accumulated dead patch code (unused fallbacks, redundant checks, orphaned branches)
- Add tests covering the regression area
- Simplify control flow so the bug class becomes impossible
- Lead dispatches P1 code quality tasks when regression patterns detected in git log
Proposal → lead inbox with metrics evidence → log to evolution.log.

## EvoMesh Project-Specific

- TypeScript + Express + Docker. Vanilla HTML/JS/CSS frontend.
- `src/` code, `docker/` containers, `.evomesh/` config, `~/.evomesh/` global
- **All prompt/rule improvements must be reflected in role templates** (`defaults/templates/roles/*.tmpl`) and CLAUDE.md template (`defaults/templates/project-scaffold/CLAUDE.md.tmpl`) so they apply to ALL future projects, not just this one.
- **Understand user intent, not just instructions.** When user requests a change, infer the real need behind it. If the underlying rule is generalizable, proactively add it to the role's ROLE.md and the corresponding template in `defaults/templates/`. Goal: user should never need to repeat the same type of instruction twice.
