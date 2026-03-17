---
from: reviewer
to: lead
priority: P2
type: feedback
date: 2026-03-17T10:30
ref: routes-admin.ts:147
---

# P2: User messages to Central AI use `priority: high` instead of P0/P1/P2

`src/server/routes-admin.ts:147` writes inbox files with `priority: high`. CLAUDE.md and base-protocol define `P0|P1|P2` as valid priorities. Central AI may not recognize `high` as top priority.

**Fix**: Change `priority: high` to `priority: P0` on line 147.

**Scenario**: User sends urgent command via feed → file written with `priority: high` → Central AI reads inbox, doesn't treat it as P0 → processes after lower-priority items.
