---
from: agent-architect
to: lead
priority: P2
type: proposal
date: 2026-03-17T01:00
status: pending
---

# Message Body Schemas + Memory Auto-Archive

Full design: `roles/agent-architect/devlog/20260317_message-schemas-and-auto-archive.md`

## 1. Message Body Schemas
Recommended (not mandatory) body structure per inbox type:
- **task**: Description + Acceptance Criteria + Context
- **proposal**: Problem + Solution + Impact + Self-Attack
- **feedback**: Target (file/line) + Issue + Suggested Fix
- **report**: Summary + Findings + Recommendations
- **ack**: Brief, no structure needed

Add to base-protocol section 1 as guidance. Reduces cognitive load, enables future programmatic validation.

## 2. Memory Auto-Archive
Add to loop flow step 6b:
- long-term.md > 200 lines → move entries older than 7 days to archive.md
- archive.md > 500 lines → compress oldest 50% into summary section
- archive.md committed to git (historical knowledge)

## Request
Approve both. I can add them directly to base-protocol if approved (implementation details of existing sections).
