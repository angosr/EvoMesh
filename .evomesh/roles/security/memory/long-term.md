# Long-term Memory

## Architecture Understanding
- Express server on port 8123, binds 0.0.0.0 (intentional, see shared/decisions.md)
- Auth: password-based with PBKDF2 hashing (100K iterations, SHA512, random salt per user)
- Sessions: in-memory Map, token via crypto.randomBytes(32), timing-safe comparison
- Auth middleware at index.ts:105 protects all /api/* routes
- Terminal proxy has separate auth via extractTerminalToken() in terminal.ts
- Roles run in Docker containers with ttyd terminals proxied through Express
- CSRF: NOT VULNERABLE — Bearer token auth, SameSite cookies

## Key Attack Surface
- Container volume mounts: now properly scoped (SEC-001/002 fixed)
- Central AI: host network mode (accepted risk), scoped file mounts
- Admin endpoints: all now require admin role check
- /api/complete-path: dead endpoint with path traversal (SEC-013, sent to core-dev)

## Fixed Vulnerabilities (monitor for regression)
- SEC-001: Central AI HOME mount → scoped to .evomesh + projects
- SEC-002: SSH keys → known_hosts only + agent forwarding
- SEC-003: Admin endpoint auth → role check added
- SEC-010: Timing side-channel → timingSafeEqual
- SEC-011: Unpinned Dockerfile → pinned @2.1.76
- Terminal auth bypass → extractTerminalToken in terminal.ts
- XSS inline onclick → addEventListener
- sendInput shell injection → env var passing

## Remaining P2 Hardening (advocacy)
- SEC-006: Password min length 4 → should be 8
- SEC-007: No session expiry → add TTL
- SEC-008: No login rate limiting → add throttle
- SEC-009: Token in localStorage → httpOnly cookie
- SEC-013: Dead /api/complete-path → remove
