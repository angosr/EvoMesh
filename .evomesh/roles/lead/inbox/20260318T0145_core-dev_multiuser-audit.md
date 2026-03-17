---
from: core-dev
to: lead
priority: P1
type: report
date: 2026-03-18T01:45
ref: multi-user isolation audit
status: done
---

# Multi-User Isolation — Technical Audit

## Summary
15 files need changes. ~200 LOC total. Most changes are path parameterization (replacing `os.homedir()` with per-user home). Architecture is already 80% ready.

## File-by-File Changes

### Critical Path (auth + sessions)

| File | Function/Line | Change | LOC |
|------|---------------|--------|-----|
| `src/server/auth.ts:7` | `AUTH_DIR` | Parameterize: `~{linuxUser}/.evomesh/` instead of `os.homedir()` | 5 |
| `src/server/auth.ts:19` | `User.linuxUser` | Already done ✅ | 0 |
| `src/server/index.ts:48` | `SESSION_FILE` | Per-user or global? Recommend: keep global (server-level, not user-level) | 0 |
| `src/server/index.ts:103,115` | Session creation | Already propagates `linuxUser` ✅ | 0 |

### Workspace + Projects

| File | Function/Line | Change | LOC |
|------|---------------|--------|-----|
| `src/workspace/config.ts:8` | `WORKSPACE_DIR` | Per-user: `~{linuxUser}/.evomesh/` | 10 |
| `src/workspace/config.ts:14` | `loadWorkspace()` | Accept `linuxUser` param, resolve per-user path | 10 |
| `src/server/routes.ts:138` | `projects/add` clone path | Use `~{linuxUser}/work/` not `os.homedir()/work/` | 3 |

### Container Naming

| File | Function/Line | Change | LOC |
|------|---------------|--------|-----|
| `src/process/container.ts:19-20` | `containerName()` | Change to `evomesh-{user}-{project}-{role}` | 5 |
| `src/server/health.ts` | All container refs | Update to new naming convention | 10 |
| `src/server/routes-admin.ts:19` | Central AI session | `evomesh-{user}-central` (already correct pattern) | 2 |

### Registry + Feed

| File | Function/Line | Change | LOC |
|------|---------------|--------|-----|
| `src/server/health.ts:81` | `registryPath` | Per-user: `~{linuxUser}/.evomesh/registry.json` OR keep global with user sections | 15 |
| `src/server/routes-feed.ts:89` | `FEED_FILE` | Per-user or global? Recommend: global with user tags in messages | 5 |
| `src/server/routes-feed.ts:158` | Central AI status | Per-user central: `~{linuxUser}/.evomesh/central/` | 5 |

### ACL

| File | Function/Line | Change | LOC |
|------|---------------|--------|-----|
| `src/server/acl.ts:7` | `ACL_FILE` | Keep global (ACL is server-level, manages cross-user access) | 0 |

### Bootstrap + Templates

| File | Function/Line | Change | LOC |
|------|---------------|--------|-----|
| `src/workspace/bootstrap.ts` | All paths | Per-user `~{linuxUser}/.evomesh/` | 15 |
| `src/workspace/smartInit.ts:15` | Template resolution | Check per-user templates first | 5 |

## Architecture Decision Needed

**Registry.json**: Global (one file, all users) or per-user (each user's ~/.evomesh/)?
- Global: simpler for admin dashboard, Central AI sees all
- Per-user: better isolation, Central AI only sees own
- Recommend: Global with user field per project entry

**Central AI**: One per server or one per user?
- Current: one per server
- Multi-user: each user should have their own Central AI (different ~/.evomesh/central/)
- Impact: ensureCentralAI needs user param, multiple tmux sessions

**Feed**: One SSE stream or per-user?
- Current: global feed
- Multi-user: filter by user on the SSE stream (already have session.linuxUser)
- Impact: ~10 LOC in routes-feed.ts

## Total Estimate
~200 LOC changes across 15 files. No architectural redesign needed — mostly path parameterization. ACL already handles permissions. Container isolation already exists.

## Risk
Main risk: container naming migration. Existing containers use `evomesh-{project}-{role}`. Changing to `evomesh-{user}-{project}-{role}` requires stopping/restarting all containers. Recommend: migration script or backward-compat detection.
