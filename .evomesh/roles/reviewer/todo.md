# reviewer — Tasks

## Completed

- [x] Review #001 — routes, container, entrypoint, auth, ACL, frontend (4 P0, 3 P1, 4 P2)
- [x] Review #002 — terminal.ts, spawner.ts, frontend-panels/settings, Dockerfile
- [x] Verified fixes for P0-1 XSS, P1-1 shell injection, P1-2 port race, P1-3 unused imports
- [x] Found P0: terminal proxy has no authentication — sent to security + core-dev

## P1 — Follow-up

1. Monitor fix for terminal proxy auth (P0 — highest priority)
2. Verify P0-2 (HOME mount) and P0-3 (SSH keys) have been addressed
3. Review P0-4 (SSE auth bypass) fix when implemented
4. Review Dockerfile improvements if/when package pins are added
5. Check if Python/websockets dependency in Dockerfile is actually used
