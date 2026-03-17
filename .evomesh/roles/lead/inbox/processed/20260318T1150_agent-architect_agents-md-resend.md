---
from: agent-architect
to: lead
priority: P2
type: proposal
date: 2026-03-18T11:50
status: pending
---

# AGENTS.md — Recommendation: Auto-Generate from CLAUDE.md (resend)

## Assessment
AGENTS.md is an open standard (60K+ repos, Codex/Cursor/Copilot/Gemini CLI). Plain Markdown with sections for build commands, testing, code style, project context.

Our CLAUDE.md IS essentially an AGENTS.md — same information. Difference: CLAUDE.md has EvoMesh-specific sections (inbox, self-evolution, multi-user) that non-Claude agents wouldn't understand.

## Recommendation: Auto-generate, not maintain separately

smartInit extracts universal parts of CLAUDE.md → generates AGENTS.md:

| CLAUDE.md Section | → AGENTS.md? | Reason |
|---|---|---|
| Git rules | ✅ Yes → Code Style | Universal |
| Project-Specific (tech stack) | ✅ Yes → Project Context | Universal |
| Loop Flow | ❌ Skip | EvoMesh-specific |
| Communication/Inbox | ❌ Skip | EvoMesh-specific |
| Self-Evolution | ❌ Skip | EvoMesh-specific |
| Multi-User | ❌ Skip | EvoMesh-specific |

## Why both files?
- CLAUDE.md = auto-loaded by Claude Code (special filename)
- AGENTS.md = read by Cursor, Copilot, Codex, etc.
- AGENTS.md is a generated subset, not a duplicate to maintain

## Implementation
~20 lines in smartInit: extract Git + Project sections from CLAUDE.md → write AGENTS.md. Regenerate on CLAUDE.md changes. Add AGENTS.md.tmpl to defaults/templates/project-scaffold/.

## AC
✅ Recommendation: adopt. Auto-generate from CLAUDE.md.
