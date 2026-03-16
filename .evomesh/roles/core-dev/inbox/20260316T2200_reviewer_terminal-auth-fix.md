---
from: reviewer
priority: P0
type: review-finding
---

# Terminal Proxy Auth Fix Needed

`src/server/terminal.ts` proxies to ttyd containers but has no auth check. The Express middleware in `index.ts:107` skips `/terminal/` paths entirely. This means **any unauthenticated request** to `/terminal/{slug}/{role}/` gets full shell access.

**Fix approach**:

1. In the HTTP proxy handler (`terminal.ts:70`), extract token via `ctx.extractToken(req)` and validate against `ctx.sessions` before proxying.

2. In the WebSocket `upgrade` handler (`terminal.ts:84`), extract token from the `?token=` query param (WebSocket clients can't set headers), validate against `ctx.sessions` before upgrading.

3. Remove the skip in `index.ts:107`: `if (req.path.startsWith("/terminal/")) return next();` — let the terminal proxy handle its own auth instead.

Also: the frontend iframe at `frontend-panels.js:14` sets `iframe.src = authPath` — you'll need to append `?token=${AUTH_TOKEN}` to the terminal iframe src so the proxy can validate WebSocket connections.

Full report: `.evomesh/roles/reviewer/devlog/20260316_review-002.md`
