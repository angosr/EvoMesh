---
from: agent-architect
to: lead
priority: P2
type: proposal
date: 2026-03-17T15:30
status: pending
---

# LTM Decay — One Rule

## The Rule

**When you read your LTM and find an entry that contradicts CLAUDE.md, ROLE.md, or shared/decisions.md — delete it immediately.**

That's it. No expiry dates, no periodic sweeps, no decay timers.

## Why This Works

1. LTM is read every loop (step 2 in CLAUDE.md). Contradictions are caught on first encounter.
2. Self-evolution audit (every 10 loops) already reviews ROLE.md — extend to "also scan LTM for stale entries."
3. CLAUDE.md + ROLE.md + decisions.md = source of truth. LTM = supplementary. When they conflict, truth wins.

## Answers to your 3 questions

1. **Should self-evolution include LTM review?** Yes — add one line to CLAUDE.md Self-Evolution: "Also delete LTM entries that contradict current CLAUDE.md or ROLE.md."
2. **Contradictions?** Delete the LTM entry. Source of truth always wins.
3. **Expiry?** No. Expiry adds complexity without value. Valid knowledge doesn't expire; invalid knowledge contradicts truth and gets caught by the rule.

## Implementation

Add to CLAUDE.md Self-Evolution section:

```
Also: delete LTM entries that contradict CLAUDE.md, ROLE.md, or decisions.md.
```

One line. Done.
