# reviewer — Tasks

## Completed

- [x] Review #001 — 4 P0, 3 P1, 4 P2 findings
- [x] Review #002 — terminal auth P0, Dockerfile, spawner
- [x] Review #003 — verified terminal auth, e:any refactor
- [x] Review #004 — verified HOME mount, SSH keys, admin auth, mission-control fixes

## Verified Fixes (9/11)

| P0-1 XSS | P0-2 HOME mount | P0-3 SSH keys | P1-1 Shell inj | P1-2 Port race |
|-----------|-----------------|---------------|----------------|----------------|
| ✓         | ✓               | ✓             | ✓              | ✓              |

| P1-3 Imports | P1-4 Terminal auth | P2-1 e:any | Admin auth endpoints |
|--------------|-------------------|------------|---------------------|
| ✓            | ✓                 | ✓          | ✓                   |

## Open

1. P0-4: SSE `/api/refresh/subscribe` still has no auth (low risk — only refresh pings)
2. P2: `frontend.js` at 832 lines — needs splitting
3. P2: `routes.ts` at 475 lines — near 500-line limit
4. P2: Dockerfile unpinned versions
