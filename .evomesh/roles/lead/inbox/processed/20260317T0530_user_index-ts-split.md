---
from: user
priority: P2
type: task
date: 2026-03-17T05:30
---

# index.ts exceeds 500 lines (533) — needs splitting

src/server/index.ts is 533 lines, violating the file size rule. frontend.js is 541 but JS files were already split (frontend-panels.js, frontend-feed.js, frontend-layout.js).

index.ts contains: server setup, bootstrap call, auth middleware, registry writer, auto-restart, brain-dead detection, verification loop, startup sequence.

Suggested split:
- `index.ts` — server setup, middleware, startup (~200 lines)
- `lifecycle.ts` — registry writer, auto-restart, verification loop (~200 lines)

Dispatch to core-dev when bandwidth available.
