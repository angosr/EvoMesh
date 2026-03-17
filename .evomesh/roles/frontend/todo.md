# frontend — Tasks

## Completed
- [x] All previous tasks (dashboard, feed, beautification, JS split, MCP scaffold, settings fields)

## Multi-User UI Audit (2026-03-18)

### Single-User Assumptions Found

**1. Auth / Identity** (frontend.js:2-8, 303-309, 475-480)
- `AUTH_TOKEN` stored in localStorage — single token, no user scoping
- `getCurrentUser()` reads from localStorage — no server validation per request
- `evomesh-user` key is global — multiple users on same browser would collide
- **Fix scope**: ~10 lines. Add username to localStorage key, validate on each fetchAll

**2. Project List** (frontend.js:62-76)
- `fetchAll()` calls `/api/projects` — server returns ALL projects
- `myRole` field exists but only used for owner/non-owner badge display
- No filtering by user ownership or ACL permissions
- **Fix scope**: Server-side filtering (not frontend). Frontend already handles `myRole` correctly.

**3. Dashboard Controls** (frontend.js:189-227)
- `isOwner` check already gates account/resource/action controls — GOOD
- Non-owners see read-only view — correct for multi-user
- **Fix scope**: None needed if server filters projects correctly.

**4. Terminal Tabs** (frontend.js:124, frontend-panels.js:1-50)
- Panel key format: `${slug}/${roleName}` — no user prefix
- Multiple users opening same role terminal would share the panel key
- **Fix scope**: ~5 lines. Prefix key with username: `${user}/${slug}/${roleName}`

**5. Settings** (frontend-settings.js:6-30)
- Profile shows current user — OK
- User management gated by `isAdmin` — correct
- Theme preference in localStorage `evomesh-theme` — global, not per-user
- **Fix scope**: ~3 lines. Key with username: `evomesh-theme-${username}`

**6. Feed / SSE** (frontend-feed.js:17-24)
- SSE stream uses `AUTH_TOKEN` for auth — OK (server validates)
- All users see same feed — may need user-scoped filtering later
- **Fix scope**: Server-side filtering if needed.

**7. Central AI Messages** (frontend-feed.js:83-105)
- `sendFeedMsg` sends to `/api/admin/message` — any authenticated user can message Central AI
- May need role-based restriction (only admin/owner)
- **Fix scope**: Server-side. Frontend already disables for non-admin if API returns 403.

### Summary

| Area | Files | Lines to Change | Blocker |
|------|-------|----------------|---------|
| Auth token scoping | frontend.js | ~10 | Server API changes |
| Project filtering | None (server) | 0 | Server API |
| Terminal panel keys | frontend.js, panels.js | ~5 | None |
| Per-user localStorage | frontend.js, layout.js | ~3 | None |
| Feed filtering | None (server) | 0 | Server API |

**Total frontend changes: ~18 lines across 3 files.** Most multi-user work is server-side (project filtering, ACL enforcement). Frontend is already well-structured with `isOwner` / `myRole` gates.

## P1 — Current Issues
(None — awaiting architecture design)

## P2
(None)
