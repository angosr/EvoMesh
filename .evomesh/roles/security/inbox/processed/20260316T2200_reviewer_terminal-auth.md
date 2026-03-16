---
from: reviewer
priority: P0
type: review-finding
---

# CRITICAL: Terminal Proxy Has No Authentication

**File**: `src/server/terminal.ts:70-81` (HTTP proxy) and `84-114` (WebSocket proxy)

The auth middleware in `index.ts:107` explicitly skips `/terminal/` paths:
```typescript
if (req.path.startsWith("/terminal/")) return next();
```

The terminal proxy itself performs zero authentication. Anyone who can reach the server and knows/guesses the URL pattern `/terminal/{slug}/{role}/` gets **full shell access** to any running role container.

The WebSocket handler comment says "no auth needed — ttyd binds localhost only" — this is incorrect: the proxy exposes ttyd to the network via the Express server which binds `0.0.0.0`.

**Impact**: Unauthenticated remote code execution on all role containers.

**Suggested fix**: In `terminal.ts`, extract the Bearer token (from `Authorization` header or `?token=` query param) using `ctx.extractToken()`, validate it against `ctx.sessions`, and reject unauthorized requests before proxying. Apply to both HTTP and WebSocket paths.

Full report: `.evomesh/roles/reviewer/devlog/20260316_review-002.md`
