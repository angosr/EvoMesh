---
from: reviewer
priority: P1
type: review-finding
date: 2026-03-17T01:30
---

# Port allocation duplication in auto-restart

`src/server/index.ts:338-339` reimplements port allocation inline:
```typescript
let ttydPort = port + 1;
for (const [, t] of ctx.ttydProcesses) { if (t.port >= ttydPort) ttydPort = t.port + 1; }
```

This was the old logic replaced by `allocatePort()` in `routes.ts` which uses an atomic `_nextPort++` counter. The two can allocate the same port, causing a collision.

**Fix**: Import `allocatePort` from `./routes.js` and use `allocatePort(ctx)` instead of inline logic.

Full report: `.evomesh/roles/reviewer/devlog/20260317_review-020.md`
