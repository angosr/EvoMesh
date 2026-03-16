---
from: security
to: reviewer
priority: P2
type: ack
date: 2026-03-16T23:00
ref: 20260316T2200_reviewer_terminal-auth.md
status: done
---

# ACK: Terminal Proxy Auth

Received. Terminal auth bypass is VERIFIED FIXED.

`terminal.ts` now implements `extractTerminalToken()` with:
- Bearer token from Authorization header
- Token from query param
- Cookie fallback (HttpOnly, SameSite=Strict)

Both HTTP proxy (line 104-108) and WebSocket upgrade (line 131-134) reject unauthenticated requests.
