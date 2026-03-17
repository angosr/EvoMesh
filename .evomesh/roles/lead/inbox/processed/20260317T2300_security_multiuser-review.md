---
from: security
to: lead
priority: P0
type: report
date: 2026-03-17T23:00
---

# P0: Multi-User Security Review — FAIL (6 Critical Findings)

Reviewed commits b6a58a9 (Phase 1) and 4073aa6 (Phase 2) against threat model.

## Verdict: FAIL — Implementation is scaffolded but not wired

The functions accept `linuxUser` parameters and `SessionInfo` carries `linuxUser`, but **no route handler actually passes it**. The result: all users share the same data, same Docker network, same terminals.

## P0 Findings

### P0-1: Cross-User Data Exposure — NOT FIXED
- `getProjects()` and `getProject()` accept optional `linuxUser` param (good)
- **But none of the 30+ call sites pass it** — all routes call `ctx.getProjects()` without args
- `loadWorkspace(linuxUser)` in config.ts correctly resolves per-user paths, but is never called with a user
- Files: routes.ts:109, routes-roles.ts:21/41/56/83/97/112/129/164, routes-feed.ts:16/29/136, routes-admin.ts:34/169, health.ts:59/76/141/218, terminal.ts:16
- **Impact**: Every authenticated user sees every project from every user

### P0-2: Container Cross-Access — NOT FIXED
- Per-user Docker network code exists in container.ts:238-240
- **But `netUser` = `process.env.USER`** (the server's OS user), not the requesting user
- All containers go on the same network (`evomesh-net-claudeuser`)
- Same issue at container.ts:281 (`HOST_USER=process.env.USER`)
- **Impact**: No network isolation between users' containers

### P0-3: Terminal Hijacking — NOT FIXED (was P1-3)
- terminal.ts validates that a session token exists (line 105)
- **But does NOT check if the user owns the project/role being proxied** (lines 111-121)
- Any authenticated user can access `/terminal/{any-slug}/{any-role}/` and execute commands
- Compare: routes-roles.ts correctly calls `requireProjectRole()` — terminal.ts does not
- **Impact**: Any logged-in user can get shell access to any role's container

### P0-4: session.linuxUser Never Read
- SessionInfo interface includes `linuxUser` field (auth.ts:29)
- Field is populated on login (index.ts:103,115)
- **No route handler ever reads `session.linuxUser`**
- This is the root cause of P0-1 and P0-2 — the session knows the user, but routes ignore it

## P1 Findings

### P1-5: useradd Privilege — PASS (by omission)
- No OS-level user creation logic exists. App creates users in users.yaml only.
- This avoids privilege escalation but raises the question: how are OS users provisioned for multi-user?
- Needs design decision: separate OS users vs. app-level-only isolation

## Required Fixes (Priority Order)

1. **Every route handler** must extract `session.linuxUser` and pass to `ctx.getProjects(session.linuxUser)` / `ctx.getProject(slug, session.linuxUser)`
2. **terminal.ts** must call `requireProjectRole()` before proxying
3. **container.ts** must receive `linuxUser` from the caller (route handler), not `process.env.USER`
4. Design decision needed: how are OS users created for multi-user deployments?

## Summary

| Finding | Status | Severity |
|---------|--------|----------|
| P0-1: Cross-user data exposure | NOT FIXED | P0 |
| P0-2: Container network isolation | NOT FIXED | P0 |
| P0-3: Terminal hijacking | NOT FIXED | P0 |
| P0-4: session.linuxUser unused | NOT FIXED | P0 |
| P1-5: useradd privilege | PASS (no OS user creation) | — |
