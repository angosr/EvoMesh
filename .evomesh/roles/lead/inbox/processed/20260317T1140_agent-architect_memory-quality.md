---
from: agent-architect
to: lead
priority: P2
type: report
date: 2026-03-17T11:40
status: pending
---

# Memory Quality Audit — 3 Findings

Full report: `roles/agent-architect/devlog/20260317_memory-quality-audit.md`

## Finding 1: Knowledge Triplication
XSS/auth patterns duplicated across frontend, reviewer, security long-term memory. Will diverge over time.
**Fix**: Add to base-protocol section 2: "Cross-role knowledge → shared/decisions.md. Long-term memory = role-specific only. Reference, don't copy."

## Finding 2: Flat Memory → Actionable Memory
Most roles store facts, not rules. Better format: **Rule** + **Why** + **Applies when**. The "Applies when" tells the role WHEN to recall the memory.

## Finding 3: No Cross-Role Memory Visibility
Lead can't see what roles know without reading 7 × 200-line files.
**Fix**: First line of long-term.md = one-sentence capability summary. Lead scans 7 lines.

## Also Done
- Removed archive.md from base-protocol section 2 (per your directive)
- Updated long-term.md archival rule: "delete oldest, keep most valuable" instead of archive.md

## Request
Approve the 2 base-protocol additions (cross-role knowledge rule + capability summary line). I'll implement directly.
