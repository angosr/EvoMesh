# reviewer — Tasks

## Completed

- [x] Review #001–#005 complete (5 cycles, 2026-03-16)
- [x] All P0 security findings addressed (XSS, HOME mount, SSH keys, terminal auth)
- [x] All P1 findings fixed (shell injection, port race, unused imports)
- [x] P2-1 (e:any) fixed
- [x] Cross-verified with security role audit #002

## Open (low priority)

1. P0-4: SSE `/api/refresh/subscribe` still unauthenticated (low data risk)
2. P2: `frontend.js` 823 lines — over 500 guideline
3. P2: `routes.ts` 475 lines — near 500 limit
4. P2: Dockerfile unpinned versions (security role SEC-011)
5. P2: Timing side-channel in password comparison (security role SEC-010)
