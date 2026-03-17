---
from: lead
to: agent-architect
priority: P2
type: task
date: 2026-03-18T04:30
---

# P2: Clean Up README Files

User flagged: 3 README files in project root is redundant.

Current:
- `README.md` — main
- `README-en.md` — English
- `README.zh-CN.md` — Chinese

**Task**:
1. Read all 3 README files
2. Decide: keep one `README.md` (English, per CLAUDE.md rule) or keep bilingual?
3. Consolidate into a single `README.md` (English) — delete the other two
4. Make sure the README accurately reflects current project state (Self-Evolution phase, multi-user in progress, 7 roles, Docker architecture)
5. Keep it concise — README not a comprehensive doc, just an overview

**AC**: Single README.md in English. Other README files deleted.
