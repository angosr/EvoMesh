# Multi-User Threat Model — 2026-03-18

## Scope
Threat model for multi-user EvoMesh with Linux user isolation (blueprint Item 7).

## Architecture Assumptions
- Each Web UI user maps to a Linux user on the host
- Containers named `evomesh-{linuxuser}-{project}-{role}`
- Single Express server (port 8123) serves all users
- Each user has their own `~/.evomesh/`, projects, containers
- ACL system (acl.ts) controls project-level access

---

## THREAT 1: Cross-User Project Access (P0 — blocks multi-user)

**Attack**: User A's API requests access User B's projects/roles.

**Current state**: `getProjects()` in index.ts reads from workspace.yaml, which is global. There's no per-user project filtering in the core data path. ACL exists (acl.ts) but is only enforced on specific endpoints via `requireProjectRole()`, not on all project enumeration.

**Gaps**:
- `GET /api/projects` filters by ACL but relies on `_session.username` — if session is spoofed or linuxUser mapping is wrong, user sees wrong projects
- `GET /api/projects/:slug/status` checks `requireProjectRole` — good
- SSE feed (`/api/feed/stream`) scans ALL projects regardless of user — **no ACL filtering**
- Mission control (`/api/mission-control`) checks first project role only — **bypasses per-project ACL for subsequent projects**
- Docker stats cache is global — all container stats visible regardless of user

**Rating**: **P0** — Must implement per-user project scoping at the data layer, not just per-endpoint ACL checks.

## THREAT 2: Container Cross-Access (P0 — blocks multi-user)

**Attack**: User A's container accesses User B's container or files.

**Current state**: All containers share the same Docker bridge network. Container names are predictable (`evomesh-{slug}-{role}`). In host mode, processes run as the same OS user.

**Gaps**:
- Docker bridge: containers can reach each other by IP. User A's role could `curl` User B's ttyd port.
- Host mode: all roles run as same OS user — full filesystem access to all users' files.
- Volume mounts: containers mount project dirs by absolute path. A container could mount User B's project if the path is known.
- SSH keys: `.ssh/` mounted from single host user — all users share same SSH keys.

**Rating**: **P0** — Requires per-user Docker networks, per-user Linux users for containers, and host mode prohibition in multi-user.

## THREAT 3: Terminal Session Hijacking (P1)

**Attack**: User A accesses User B's terminal via `/terminal/{slug}/{role}/`.

**Current state**: Terminal proxy in `terminal.ts` validates session token but doesn't check if the authenticated user has access to the specific project/role.

**Gaps**:
- `extractTerminalToken()` validates the token is a valid session but doesn't check project ACL
- Any authenticated user can proxy to any terminal if they know the URL pattern
- ttyd has no per-connection auth — the Express proxy is the only gate

**Rating**: **P1** — Must add ACL check in terminal proxy: validate that session's user has access to the project containing the role.

## THREAT 4: Shared Express Server Privilege Escalation (P1)

**Attack**: Single server process serves all users. Server-side bugs could leak cross-user data.

**Current state**: One Express process, one `sessions` Map, one `ttydProcesses` Map, one `statsCache`. All users' data co-exists in memory.

**Gaps**:
- Session tokens are global — if the Map is enumerable via a bug, all tokens leak
- `sessions.json` persistence contains ALL users' tokens in one file
- `registry.json` contains all projects regardless of user
- `feed.jsonl` contains activity from all roles across all users

**Rating**: **P1** — Must namespace persistent files per user. In-memory maps need user-aware access patterns.

## THREAT 5: Docker userns-remap Limitations (P2)

**Attack**: Container escapes user namespace mapping.

**Analysis**: Docker userns-remap maps container root (UID 0) to an unprivileged host UID. This prevents container-to-host privilege escalation. However:
- Volume mounts bypass userns-remap — files are accessed as the mapped UID, which may not match the intended Linux user
- If User A's container mounts `/home/userB/project`, userns-remap doesn't help — the mapped UID may still have read access
- Solution: filesystem permissions + dedicated Linux users per EvoMesh user

**Rating**: **P2** — userns-remap is defense-in-depth, not primary isolation. Linux user filesystem permissions are the real gate.

## THREAT 6: Git Race Conditions (P2)

**Attack**: Multiple users' roles push to same git repo simultaneously — merge conflicts, lost commits.

**Current state**: Roles use `git pull --rebase` then push. No locking mechanism.

**Gaps**:
- Concurrent pushes cause "failed to push" errors (git rejects non-fast-forward)
- `git pull --rebase` can fail with conflicts
- No retry logic — failed pushes are silently swallowed

**Rating**: **P2** — Annoying but not a security vulnerability. Git prevents data loss (rejected pushes don't overwrite). Roles retry next loop.

## THREAT 7: User Registration → Linux User Creation (P1)

**Attack**: Malicious registration creates arbitrary Linux users or exhausts system resources.

**Current state**: Admin creates users via `POST /api/users` (admin-only). `linuxUser` field exists but is not yet used for `useradd`.

**Gaps**:
- When `useradd` is implemented: username must be validated (no shell metacharacters, length limits)
- Resource exhaustion: unlimited user creation → unlimited Linux users → disk/memory exhaustion
- Privilege escalation: if `useradd` runs as root (required), the server process needs root or sudoers entry

**Rating**: **P1** — User creation must validate usernames strictly and limit total users. Server should NOT run as root — use a privileged helper process for `useradd` only.

---

## Summary

| Threat | Rating | Blocks Multi-User? |
|--------|--------|-------------------|
| T1: Cross-user project access | **P0** | YES — API endpoints leak cross-user data |
| T2: Container cross-access | **P0** | YES — shared network + same OS user |
| T3: Terminal session hijacking | P1 | No — fixable in terminal.ts |
| T4: Shared server data leaks | P1 | No — namespace persistent files |
| T5: userns-remap limitations | P2 | No — defense-in-depth |
| T6: Git race conditions | P2 | No — annoying, not dangerous |
| T7: User creation privilege | P1 | No — validate + privilege separation |

## Recommendations

**Before enabling multi-user (P0)**:
1. Per-user project scoping in ALL API endpoints (not just some)
2. Per-user Docker networks (User A's containers can't reach User B's)
3. Disable host mode for non-admin users (no container isolation = no user isolation)

**Before production (P1)**:
4. ACL check in terminal proxy (`terminal.ts`)
5. Per-user `sessions.json`, `feed.jsonl`, `registry.json`
6. Strict username validation for Linux user creation
7. Privileged helper process for `useradd` (not root Express server)

**Nice-to-have (P2)**:
8. Docker userns-remap for defense-in-depth
9. Git push retry logic
