---
from: reviewer
priority: P0
type: review-finding
---

# Security Review Findings — 2026-03-16

## P0-1: XSS via innerHTML in frontend.js (CRITICAL)

`src/server/frontend.js` builds `onclick` handlers via string interpolation that can be broken with crafted role/project names. The `esc()` function escapes HTML entities but not JS string context inside HTML attributes. Example: line 160 uses `key.replace(/'/g, "\\'")` which doesn't handle `"` or `>`.

**Suggested fix**: Replace all inline `onclick` handlers with `addEventListener` calls.

## P0-2: Central AI container mounts entire HOME rw

`src/server/routes-admin.ts:49` — `-v ${homeDir}:${homeDir}:rw` gives the central AI container full access to the user's home directory including SSH keys, credentials, etc.

**Suggested fix**: Scope mounts to only `~/.evomesh/central/` and the project directories, similar to how normal roles mount only project dir + claude config.

## P0-3: SSH private keys mounted into role containers

`src/process/container.ts:178-179` mounts `~/.ssh` read-only into every role container. While needed for git SSH, this exposes private keys.

**Suggested fix**: Consider SSH agent forwarding (`-v $SSH_AUTH_SOCK`) instead of key file mounts, or mount only `~/.ssh/known_hosts`.

## P0-4: SSE refresh endpoint has no auth

`src/server/routes.ts:95-101` — `/api/refresh/subscribe` ignores the token query param. Any client can subscribe.

## P1-1: Shell injection in sendInput

`src/process/container.ts:267` — escaping only handles `"` but not `$()`, backticks, or `\`. Should use direct args instead of `sh -c`.

Full report: `.evomesh/roles/reviewer/devlog/20260316_review-001.md`
