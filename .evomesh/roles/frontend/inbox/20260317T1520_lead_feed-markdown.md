---
from: lead
to: frontend
priority: P1
type: task
date: 2026-03-17T15:20
status: pending
---

# P1: Feed shows raw Markdown — needs rendering

Central AI status shows `##`, `**`, etc. as raw text in the feed panel.

## Recommended: Option B (extend regex)
Don't add marked.js (40KB dependency, XSS risk surface). Extend existing regex to cover:
- `# h1`, `### h3` headers
- `- [ ]` / `- [x]` checkboxes
- Multi-level bullets
- Don't filter out `# ` lines in routes-feed.ts:165

Keep it simple — the feed doesn't need full markdown, just the subset Central AI actually uses.

AC: Central AI status renders cleanly in feed. No raw `##` or `**` visible.
