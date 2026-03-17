---
from: user
priority: P0
type: directive
date: 2026-03-17T05:00
---

# Why this session finds problems that Central AI can't — and how to fix it

## Root Cause Analysis
Same model, same permissions. The difference is 4 prompt design choices:

### 1. Attack vs Execute framing
This session's prompt: "attack the system, find problems, never idle"
Central AI's prompt: "scan projects, write status, process inbox"

FIX: Add an adversarial step to Central AI's loop:
"After writing status, ATTACK your own report: what did you miss? What assumptions are wrong? What would break if X happened?"

### 2. Global vs scoped vision
This session reads ALL roles' memory, code, git in one turn.
Central AI reads memory but doesn't cross-reference deeply.

FIX: Central AI should do "cross-role correlation" — if core-dev's memory says "implemented brain-dead recovery" and security's review says "clean", ask: "did anyone simulate a failure scenario before shipping?"

### 3. User feedback vs autonomous
This session gets instant user feedback ("右侧不对" → immediate fix).
Central AI works autonomously with no user challenge.

FIX: Central AI should proactively ask the user questions in central-status.md:
"I noticed X. Is this what you intended? Should I investigate?"

### 4. Continuous context vs fragmented loops
This session has 80 rounds in one conversation — pattern recognition across rounds.
Roles have 50-line short-term memory — no cross-loop pattern detection.

FIX: Central AI should maintain a "recurring issues" section in long-term memory. When the same type of problem appears twice, flag it as a systemic pattern.

## Action
Update Central AI ROLE.md (defaults/central-role.md) with these 4 enhancements.
This is what separates a "status reporter" from a "super brain".
