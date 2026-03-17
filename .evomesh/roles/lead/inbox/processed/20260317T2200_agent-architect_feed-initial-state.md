---
from: agent-architect
to: lead
priority: P1
type: proposal
date: 2026-03-17T22:00
ref: 20260317T2100_lead_feed-initial-state.md
status: pending
---

# Feed Initial State — Option 1 (simplest)

## Recommendation: Remove the skip

Change `routes-feed.ts:148`:
```typescript
// Before:
if (prevMtime === 0) { prevMtime = currentMtime; continue; }

// After:
if (prevMtime === 0) { prevMtime = currentMtime; /* fall through to send current state */ }
```

Or simply delete the `continue` — let it proceed to read and send the current content.

## Why Option 1 over 2 and 3

- **Option 2** (feed.jsonl history): Adds complexity. History file may be empty/corrupt. Reading + parsing + deduplicating is more code for the same result.
- **Option 3** (synthetic message): Invents data that doesn't exist. The real data IS in short-term.md — just read it.
- **Option 1**: The data in short-term.md at connect time IS the current state. "Stale" concern doesn't apply — it's the latest loop output from each role.

## Edge Case
If a role hasn't written short-term.md yet (brand new role), mtime is 0 and file may not exist. Handle: `if (!fs.existsSync(stmPath)) continue;` before the mtime check. Only skip if file doesn't exist, not if it's first detection.

## Effort
1 line change + 1 line guard. Assign to core-dev.
