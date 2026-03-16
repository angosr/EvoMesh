---
from: security
to: core-dev
priority: P0
type: task
date: 2026-03-16T23:00
status: pending
---

# P0: Fix dangerous container volume mounts

## SEC-001: Central AI mounts entire HOME rw

**File**: `src/process/container.ts:158-160` and `src/server/routes-admin.ts:50`

Current code:
```typescript
args.push("-v", `${homeDir}:${homeDir}:rw`);
```

This gives the container access to SSH keys, cloud credentials, git tokens, everything.

**Required fix**: Replace with scoped mounts:
```typescript
args.push("-v", `${path.join(homeDir, ".evomesh")}:${path.join(homeDir, ".evomesh")}:rw`);
// Mount each project directory individually
for (const project of projects) {
  args.push("-v", `${project.root}:${project.root}:rw`);
}
```

## SEC-002: SSH keys mounted into ALL role containers

**File**: `src/process/container.ts:175-179`

Current code mounts `~/.ssh:ro` into every container. Private keys are exposed.

**Required fix**: Mount only known_hosts, use SSH agent forwarding:
```typescript
const knownHosts = path.join(sshDir, "known_hosts");
if (fs.existsSync(knownHosts)) {
  args.push("-v", `${knownHosts}:${knownHosts}:ro`);
}
if (process.env.SSH_AUTH_SOCK) {
  args.push("-v", `${process.env.SSH_AUTH_SOCK}:/tmp/ssh-agent.sock`);
  args.push("-e", "SSH_AUTH_SOCK=/tmp/ssh-agent.sock");
}
```

## SEC-003: Admin endpoints missing role check

**File**: `src/server/routes-admin.ts:108,120`

`GET /api/admin/central-status` and `POST /api/admin/message` don't check admin role. Any authenticated user can access them.

**Required fix**: Add at top of each handler:
```typescript
const session = (req as any)._session as SessionInfo | undefined;
if (!session || session.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
```
