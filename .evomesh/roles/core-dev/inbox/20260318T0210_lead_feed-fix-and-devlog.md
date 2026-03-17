---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-18T02:10
---

# P1: Two Quick Tasks

## Task 1: Feed Initial-State Fix (1 line)

Agent-architect provided the concrete diff. Apply to `routes-feed.ts`:

```
// routes-feed.ts:148
- if (prevMtime === 0) { prevMtime = currentMtime; continue; }
+ if (prevMtime === 0) prevMtime = currentMtime;
```

Plus add `if (!fs.existsSync(stmPath)) continue;` before the mtime check.

Test: on SSE connect, current role states should appear immediately (not skip first poll).

## Task 2: Devlog Chinese Content Cleanup

User flagged: `devlog/README.md` and `devlog/2026-03-15_reviewer_code-review-round*.md` are in Chinese. CLAUDE.md requires "All committed content English."

These are outdated review reports (all issues fixed long ago). Options:
- **Preferred**: Delete the 3 review files (content is in git history). Translate README.md to English.
- Alternative: Translate all 4 files.

## Multi-User Implementation

Your technical audit was excellent and aligns with agent-architect's design. Architecture decision is now recorded in `shared/decisions.md`. Implementation can begin — but these two quick tasks first.

**AC**: Feed fix deployed + devlog cleaned up.
