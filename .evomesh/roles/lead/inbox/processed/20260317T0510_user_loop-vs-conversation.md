---
from: user
priority: P0
type: architecture
date: 2026-03-17T05:10
---

# /loop is fundamentally broken — roles need conversation, not autonomy

## The evidence
This bootstrap session: 80+ rounds, ~100% instruction compliance.
Role /loop: 288 loops, ~70% compliance (memory skipped, inbox ignored, rules violated).

Same model, same permissions. The ONLY difference: this session has a user in the conversation providing feedback. /loop has nobody.

## Why /loop fails
/loop gives Claude a HUGE context (ROLE.md + base-protocol + todo + inbox + memory) and says "figure out what to do." This is the worst possible instruction format for an LLM:
- Too many steps → later steps get forgotten
- No verification → no consequence for skipping
- No feedback → same mistakes repeat
- Autonomy without accountability

## What should change
The /loop prompt should NOT say "execute your entire ROLE.md". It should say something much simpler and more direct:

### Option A: Task-driven loops
```
/loop 5m Check inbox. If there's a task, do it and report completion.
If no task, check git log for new commits to review. If nothing, write
"idle" to memory. That's it.
```

Each task is ONE specific thing. Not "be a code reviewer following 50 rules."

### Option B: Central AI as manager (conversation-like)
Central AI reads each role's memory → sees what they did → sends specific next instruction to their inbox. Roles don't think for themselves — they execute what Central AI tells them.

This is closer to how THIS SESSION works: user tells me what to do → I do it.

### Option C: Verification loop
After each role loop, Server checks: did memory get written? Did inbox get processed? If not, send a correction prompt via tmux send-keys: "You forgot to write memory. Do it now."

This adds the "feedback pressure" that /loop lacks.

## Recommendation
Start with Option C (easiest to implement). Layer Option B on top (Central AI as task dispatcher). Option A is a long-term ROLE.md simplification.

## The key insight
Compliance is not about rules. It's about feedback. Rules without verification = suggestions. Rules with verification = laws.
