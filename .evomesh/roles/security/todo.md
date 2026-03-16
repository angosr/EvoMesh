# security — Tasks

## P0 — Initial Audit

1. Scan for hardcoded values: `grep -rn "hardcode\|password\|secret\|token" src/`
2. Check all API endpoints for authentication
3. Review Docker volume mounts — are we over-exposing?
4. Check container network config (host vs bridge)
5. Review auth system (password hashing, session management)
6. Write security audit report to devlog/
