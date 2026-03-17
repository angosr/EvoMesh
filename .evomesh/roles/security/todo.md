# security — Tasks

## P0 — Critical (all fixed ✅)

1. ~~Scan for hardcoded values~~ ✅ PASS
2. ~~Check all API endpoints for authentication~~ ✅ PASS
3. ~~Review Docker volume mounts~~ ✅ SEC-001 FIXED
4. ~~Check container network config~~ ✅ SEC-004 documented
5. ~~Review auth system~~ ✅ PASS (strong PBKDF2)
6. ~~Write security audit report~~ ✅ audit-001 + audit-002

## P0 — Track Fixes

- [ ] SEC-016: No TLS — HTTP server exposes all traffic (passwords, tokens, shell I/O) → sent to lead + core-dev
- [x] SEC-001: Central AI HOME mount rw → FIXED (scoped mounts)
- [x] SEC-002: SSH keys in containers → USER OVERRIDE: full .ssh/ mounted ro (locked decision, do not revert)
- [x] SEC-003: Admin endpoints missing role check → FIXED

## P1 — Completed

- [x] SEC-004: Central AI host network mode → documented as accepted risk
- [x] SEC-005: Project root rw mount → accepted (required for file-based comms)
- [x] Audit ACL system → PASS
- [x] Review entrypoint.sh privilege drop → PASS
- [x] Dependency review → PASS (no known CVEs)

## P2 — Open

- [ ] SEC-006: Strengthen password policy (min 8 chars)
- [ ] SEC-007: Add session expiry/rotation
- [ ] SEC-008: Add login rate limiting
- [ ] SEC-009: Move token from localStorage to httpOnly cookie
- [x] SEC-013: Remove dead /api/complete-path endpoint → FIXED (endpoint removed)

## P2 — Fixed/Closed

- [x] SEC-010: Use timingSafeEqual → FIXED
- [x] SEC-011: Pin claude-code version in Dockerfile → FIXED (pinned @2.1.76)
- [x] SEC-012: Document --dangerously-skip-permissions → accepted risk
- [x] CSRF protection audit → NOT VULNERABLE (Bearer token auth)
- [x] Path traversal test → found SEC-013
