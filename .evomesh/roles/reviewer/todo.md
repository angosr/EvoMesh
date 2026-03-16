# reviewer — Tasks

## Completed

- [x] Reviews #001–#006 complete (6 cycles, 2026-03-16)
- [x] All P0 security findings resolved (XSS, HOME mount, SSH keys, terminal auth)
- [x] All P1 bug findings resolved (shell injection, port race, unused imports)
- [x] P2 fixes verified: e:any, timing-safe auth, Dockerfile pins, unused dep removal

## Open (low priority)

1. P0-4: SSE `/api/refresh/subscribe` unauthenticated (low data risk — only refresh pings)
2. `routes.ts` at 485/500 lines — extract mission-control to `routes-mission.ts` before limit hit
3. `frontend.js` at 823 lines — over 500 guideline
4. `python3-pip` still in Dockerfile apt install (unused after websockets removal)
