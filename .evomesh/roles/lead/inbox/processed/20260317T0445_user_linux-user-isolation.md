---
from: user
priority: P0
type: design
date: 2026-03-17T04:45
---

# Multi-tenant permission system — Linux user isolation

## Design Intent
Physical isolation via Linux users. Each Linux user is an independent tenant with their own Central AI, projects, and workspace.

## Permission Hierarchy

### System Role: admin
- Can create/delete Linux users on the system
- When creating a user in Web UI: text input with autocomplete from `getent passwd` (list existing Linux users)
- If Linux user doesn't exist → confirmation dialog: "Create new Linux user {name}?"
- Can switch between Linux users (impersonate) to manage their workspaces
- Sees all Linux users and their projects

### System Role: owner (= a Linux user)
- Has their own `~/.evomesh/` (own Central AI, own workspace, own templates)
- Sees only their own projects
- Can add regular users (viewer/member) to their projects
- When adding users: can only authorize access to THEIR OWN projects
- Cannot specify which Linux user the regular user belongs to — they're adding to their own namespace
- Operates their own Central AI

### System Role: regular user (viewer/member)
- Can only see projects they've been authorized to view
- Cannot operate Central AI (each Linux user's Central AI is independent)
- Cannot start/stop roles
- Can view dashboard, feed, terminal (read-only)

## Data Isolation

```
/home/alice/.evomesh/          ← Alice's namespace
  central/ROLE.md              ← Alice's Central AI
  workspace.yaml               ← Alice's projects
  registry.json                ← Alice's role states

/home/bob/.evomesh/            ← Bob's namespace (completely separate)
  central/ROLE.md              ← Bob's Central AI
  workspace.yaml               ← Bob's projects
```

Server runs as a privileged user (or with sudo) that can:
- Read/write any Linux user's `~/.evomesh/`
- Start containers as any Linux user (Docker --user flag)
- Start tmux sessions as any Linux user (sudo -u)

## Changes Needed

### 1. User model (auth.ts)
Add `linuxUser` field to User:
```typescript
interface User {
  username: string;
  passwordHash: string;
  salt: string;
  role: "admin" | "owner" | "user";
  linuxUser: string;  // which Linux user this account maps to
  createdAt: string;
}
```

### 2. Admin UI — create user
- Input: username, password, role (admin/owner/user), Linux user
- Linux user field: autocomplete from `getent passwd | grep -v nologin`
- If typed Linux user doesn't exist: "Linux user {x} not found. Create it?" → `sudo useradd -m {x}`

### 3. Project visibility
- `getProjects()` must filter by current user's `linuxUser`
- Admin sees all Linux users' projects (with user label)
- Owner sees only projects in their own `~{linuxUser}/`

### 4. Central AI isolation
- Each Linux user has independent Central AI at `~{linuxUser}/.evomesh/central/`
- Web UI Central AI button → connects to current user's Central AI
- Admin can switch to any user's Central AI

### 5. Feed isolation
- Feed only shows roles from projects the current user can see

## Dispatch
- agent-architect: design the detailed permission model
- core-dev: implement auth changes + project filtering
- frontend: admin UI for Linux user management
