# reviewer — Tasks

## Completed

- [x] Review #001 — routes, container, entrypoint, auth, ACL, frontend (4 P0, 3 P1, 4 P2)
- [x] Review #002 — terminal.ts, spawner.ts, frontend-panels/settings, Dockerfile
- [x] Review #003 — verified terminal auth fix, e:any refactor, mission-control, smoke tests
- [x] Verified: P0-1 XSS, P1-1 shell injection, P1-2 port race, P1-3 unused imports, P1-4 terminal auth, P2-1 e:any

## P1 — Follow-up

1. Monitor P0-2 (HOME mount) and P0-3 (SSH keys) — still open
2. Monitor P0-4 (SSE auth bypass) — still open
3. Watch routes.ts (473/500 lines) and frontend.js (806 lines) — needs splitting
4. Review mission-control UI code in frontend.js when next touched
5. Re-review Dockerfile when package pins are added
