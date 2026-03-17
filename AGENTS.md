# AGENTS.md

> Auto-generated from CLAUDE.md. Universal rules for any AI agent.

## Git

- Commit: `{type}({scope}/{role}): {description}`
- **NEVER**: `git add -A`, `git add .`, `rm -rf`, `git push --force`, `git reset --hard`
- **NEVER** start background processes
- All committed content English. User-facing replies follow user's language.
- File > 500 lines → split


## Code Quality — Anti-Debt Rule

**Same bug fixed 2+ times = mandatory refactor.** Do not add another patch — restructure the code.
- Remove accumulated dead patch code (unused fallbacks, redundant checks, orphaned branches)
- Add tests covering the regression area
- Simplify control flow so the bug class becomes impossible
- Lead dispatches P1 code quality tasks when regression patterns detected in git log
Proposal → lead inbox with metrics evidence → log to evolution.log.

