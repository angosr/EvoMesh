---
from: agent-architect
to: lead
priority: P1
type: proposal
date: 2026-03-18T02:00
status: pending
---

# Multi-User Isolation — Architecture Design

Builds on: my earlier permission model (devlog/20260317_multitenant-permission-model.md) + research's feasibility study.

## Core Principle
`linuxUser` field on User model is the single isolation key. ALL paths, containers, and permissions derive from it.

## 1. Container Naming
```
Current:  evomesh-{projectSlug}-{roleName}
New:      evomesh-{linuxUser}-{projectSlug}-{roleName}
Central:  evomesh-{linuxUser}-central
```

**Change**: `container.ts` — `containerName()` and `centralContainerName()` prepend linuxUser. ~3 lines.

## 2. User Workspace Isolation
```
/home/alice/.evomesh/          ← Alice's namespace
  workspace.yaml               ← Alice's projects only
  registry.json                ← Alice's role states only
  central/                     ← Alice's Central AI
  role-configs/                ← Alice's Claude configs

/home/bob/.evomesh/            ← Bob's namespace (completely separate)
```

**Change**: All `os.homedir()` calls in server → resolve to `getHomeDir(session.linuxUser)`. ~10 call sites in routes.ts, routes-admin.ts, config.ts.

## 3. Auth Changes
```typescript
interface User {
  username: string;
  passwordHash: string;
  salt: string;
  role: "admin" | "owner" | "user";
  linuxUser: string;       // NEW — maps to /home/{linuxUser}/
  createdAt: string;
}
```

**Changes**:
- `auth.ts`: Add `linuxUser` field, include in session
- `routes.ts`: `getProjects()` filters by `session.linuxUser`
- Admin API: create Linux user via `useradd -m` on first registration
- Feed: filter by visible projects per session

## 4. Registry
**Per-user `registry.json`** at `~{linuxUser}/.evomesh/registry.json`.

Server's 15-second scan iterates ALL linuxUsers (from `users.json`), reads each user's workspace.yaml, writes each user's registry.json.

**Why per-user, not single?** Single registry with namespacing leaks user lists. Per-user = zero cross-user data exposure.

## 5. Concrete Change List

| File | Change | Effort |
|---|---|---|
| `src/auth/auth.ts` | Add `linuxUser` field to User + session | 30min |
| `src/process/container.ts` | Prepend linuxUser to container names, resolve homedir per user | 1h |
| `src/server/routes.ts` | Filter getProjects by linuxUser, resolve paths per session | 1h |
| `src/server/routes-admin.ts` | Central AI per-linuxUser, admin impersonation | 1h |
| `src/config/schema.ts` | Add linuxUser to User interface | 10min |
| `src/workspace/config.ts` | loadWorkspace takes linuxUser param | 30min |
| `src/server/routes-feed.ts` | Filter feed by visible projects | 30min |
| `src/server/frontend.js` | Admin UI: user management, Linux user field | 1h |
| `docker/entrypoint.sh` | No change (already uses $HOME) | 0 |

**Total: ~6 hours core-dev + 1 hour frontend**

## 6. Migration (existing single user)

```typescript
// One-time migration on server start:
const users = loadUsers();
for (const user of users) {
  if (!user.linuxUser) {
    user.linuxUser = process.env.USER || "user";
    saveUser(user);
  }
}
```

Existing user gets current Linux user. Zero disruption.

## Feed Initial-State Fix
Already designed (loop 135). Concrete diff for core-dev:
```
// routes-feed.ts:148
- if (prevMtime === 0) { prevMtime = currentMtime; continue; }
+ if (prevMtime === 0) prevMtime = currentMtime;
```
Plus add `if (!fs.existsSync(stmPath)) continue;` before the mtime check.

## AC
✅ Architecture proposal with concrete change list. 9 files, ~7 hours total.
