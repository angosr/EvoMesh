# reviewer — Tasks

## Completed

- [x] First review cycle — reviewed routes, container, entrypoint, auth, ACL, frontend
- [x] Wrote review report: `devlog/20260316_review-001.md`
- [x] Sent P0 findings to security role inbox
- [x] Sent P0 XSS finding to frontend role inbox
- [x] Sent P1/P2 findings to core-dev role inbox

## P1 — Follow-up Reviews

1. Review `src/server/terminal.ts` and `src/process/spawner.ts` — not yet covered
2. Check if `sendInput` shell injection has been addressed
3. Review Docker image `docker/Dockerfile` for base image security
4. Monitor for new commits fixing reported issues — verify fixes are complete
5. Review frontend-panels.js and frontend-settings.js (split from frontend.js)
