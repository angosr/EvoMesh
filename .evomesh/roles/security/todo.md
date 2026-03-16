# security — Tasks

## P0 — Critical (waiting on core-dev)

1. ~~Scan for hardcoded values~~ ✅ PASS — no secrets found
2. ~~Check all API endpoints for authentication~~ ✅ All /api/* protected by middleware
3. ~~Review Docker volume mounts~~ ✅ Found SEC-001 (HOME rw), SEC-002 (SSH keys) → sent to core-dev
4. ~~Check container network config~~ ✅ Found SEC-004 (host network for Central AI)
5. ~~Review auth system~~ ✅ PBKDF2 sound, found SEC-006/007/008 (weak policy, no expiry, no rate limit)
6. ~~Write security audit report~~ ✅ devlog/20260316_audit-001.md

## P0 — Track Fixes

- [ ] SEC-001: Central AI HOME mount rw → waiting on core-dev fix
- [ ] SEC-002: SSH keys in containers → waiting on core-dev fix
- [ ] SEC-003: Admin endpoints missing role check → waiting on core-dev fix

## P1 — Next Audit Cycle

- [ ] SEC-004: Central AI host network mode — evaluate mitigation
- [ ] SEC-005: Project root rw mount — document accepted risk
- [ ] Audit ACL system (src/server/acl.ts) for privilege escalation
- [ ] Review entrypoint.sh privilege drop timing
- [ ] Dependency audit (package.json CVEs)

## P2 — Hardening

- [ ] SEC-006: Strengthen password policy (min 8 chars)
- [ ] SEC-007: Add session expiry/rotation
- [ ] SEC-008: Add login rate limiting
- [ ] SEC-009: Move token from localStorage to httpOnly cookie
- [ ] CSRF protection audit
