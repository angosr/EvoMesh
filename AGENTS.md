# AGENTS.md

> Auto-generated from CLAUDE.md. Universal rules for any AI agent.

## Git

- Commit: `{type}({scope}/{role}): {description}`
- **NEVER**: `git add -A`, `git add .`, `rm -rf`, `git push --force`, `git reset --hard`
- **NEVER** start background processes
- **NO bookkeeping-only commits**: Do NOT commit if the only changes are: `heartbeat.json`, `memory/short-term.md`, `todo.md`, or updating `status.md`/`blueprint.md` with no new decisions. These are administrative overhead, not deliverables. Only commit when the loop produces **real output**: code changes, new inbox messages dispatched, inbox deletions (`git rm`), new decisions in `shared/decisions.md`, config changes, or documentation with new content. Bundle all bookkeeping files into the next commit that contains real work.
- Code, commit messages, shared/decisions.md, blueprint.md: English.
- `memory/short-term.md`, `todo.md`, inbox messages: follow user's language (these are user-facing via the Feed panel, not technical documentation).
- File > 500 lines → split


## Code Quality — Anti-Debt Rule

**Same bug fixed 2+ times = mandatory refactor.** Do not add another patch — restructure the code.
- Remove accumulated dead patch code (unused fallbacks, redundant checks, orphaned branches)
- Add tests covering the regression area
- Simplify control flow so the bug class becomes impossible
- Lead dispatches P1 code quality tasks when regression patterns detected in git log
Proposal → lead inbox with metrics evidence → log to evolution.log.

