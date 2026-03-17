# Design: Multi-Tenant Permission Model

## 1. Permission Matrix

| Action | admin | owner | user (member) |
|---|---|---|---|
| **System** | | | |
| Create/delete Linux users | ✅ | ❌ | ❌ |
| Switch to any user's namespace | ✅ | ❌ | ❌ |
| View all projects across users | ✅ | ❌ | ❌ |
| Manage server settings | ✅ | ❌ | ❌ |
| **Projects (own namespace)** | | | |
| Create/delete projects | ✅ | ✅ | ❌ |
| Add/remove roles to project | ✅ | ✅ | ❌ |
| Start/stop/restart roles | ✅ | ✅ | ❌ |
| View dashboard + feed | ✅ | ✅ | ✅ (authorized projects only) |
| View terminal (read-only) | ✅ | ✅ | ✅ (authorized projects only) |
| Send terminal input | ✅ | ✅ | ❌ |
| **Central AI** | | | |
| Operate own Central AI | ✅ | ✅ | ❌ |
| View own Central AI status | ✅ | ✅ | ❌ |
| Switch to other user's Central AI | ✅ | ❌ | ❌ |
| **User Management** | | | |
| Add members to own projects | ✅ | ✅ | ❌ |
| Manage other users' accounts | ✅ | ❌ | ❌ |

## 2. Linux User → Filesystem Mapping

```
Session login: alice (role: owner, linuxUser: alice)
  → Server reads: /home/alice/.evomesh/workspace.yaml
  → Projects from: /home/alice/work/*
  → Central AI: /home/alice/.evomesh/central/
  → Registry: /home/alice/.evomesh/registry.json
  → Templates: /home/alice/.evomesh/templates/ (fallback: project-local)
  → Role configs: /home/alice/.evomesh/role-configs/

Session login: admin (role: admin, linuxUser: admin)
  → Can switch context: "View as alice" → reads alice's namespace
  → Own workspace: /home/admin/.evomesh/ (for admin's own projects)
```

**Key principle**: `linuxUser` determines ALL filesystem paths. Server resolves `~` to `/home/{linuxUser}/` for all operations.

## 3. Server Process Model

### Option A: Single Server, sudo per-operation (RECOMMENDED)
```
Server runs as: evomesh-server (dedicated user with sudo rights)

Start container as alice:
  docker run --user $(id -u alice):$(id -g alice) ...

Start tmux as alice:
  sudo -u alice tmux new-session ...

Read alice's config:
  sudo -u alice cat /home/alice/.evomesh/workspace.yaml
```

**Sudoers config** (`/etc/sudoers.d/evomesh`):
```
evomesh-server ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/tmux, /bin/cat, /bin/ls, /bin/mkdir
```

### Option B: Server runs as root
Simpler but worse security posture. Not recommended.

### Option C: Per-user server instances
Overkill — multiple server processes, port conflicts. Not recommended.

**Recommend A**: single server, scoped sudo.

## 4. Feed Isolation

```typescript
function getVisibleProjects(session: Session): Project[] {
  if (session.role === "admin") {
    // Admin sees all users' projects, grouped by linuxUser
    return getAllLinuxUsers()
      .flatMap(lu => loadWorkspace(lu).projects
        .map(p => ({ ...p, linuxUser: lu })));
  }
  if (session.role === "owner") {
    // Owner sees only own projects
    return loadWorkspace(session.linuxUser).projects;
  }
  // Member sees only authorized projects
  return loadWorkspace(session.linuxUser).projects
    .filter(p => p.authorizedUsers?.includes(session.username));
}
```

Feed filters by visible projects:
```typescript
function getFeed(session: Session): FeedItem[] {
  const visibleSlugs = getVisibleProjects(session).map(p => p.slug);
  return allFeedItems.filter(item => visibleSlugs.includes(item.projectSlug));
}
```

## 5. Edge Cases

### Admin Impersonation
- Admin clicks "View as alice" → session gains `impersonating: "alice"` flag
- All reads use alice's namespace (workspace, registry, projects)
- All writes ALSO use alice's namespace (start/stop roles, Central AI commands)
- UI shows banner: "Viewing as alice — [Exit impersonation]"
- Audit log records: "admin performed X as alice at time T"
- Admin CANNOT delete alice's Linux user while impersonating (safety)

### Owner Creates Project in Shared Directory
- Owner alice creates project at `/shared/team-project/`
- Filesystem permission check: can alice's Linux user write there?
- If no → reject with "Permission denied: alice cannot write to /shared/team-project/"
- If yes → project belongs to alice's namespace regardless of path location

### Member Added to Non-Existent Project
- Owner alice adds member bob to project "my-app"
- Bob logs in, sees "my-app" in dashboard
- Bob's view is read-only (dashboard, feed, terminal viewing)
- Bob cannot start/stop roles or send Central AI commands

### Multiple Web UI Accounts → Same Linux User
- Alice creates 2 accounts: alice-work (owner), alice-viewer (user), both with linuxUser=alice
- Both see the same projects (same namespace)
- alice-work can manage roles, alice-viewer can only view
- This is valid — allows fine-grained access control within a namespace

### Central AI Cross-User Isolation
- Alice's Central AI only has access to alice's HOME, alice's projects
- Bob's Central AI only has access to bob's HOME, bob's projects
- They cannot see each other's work at the filesystem level
- No shared Central AI — each is fully independent

## 6. Data Model Changes

```typescript
// auth.ts
interface User {
  username: string;
  passwordHash: string;
  salt: string;
  role: "admin" | "owner" | "user";
  linuxUser: string;       // Maps to /home/{linuxUser}/
  createdAt: string;
  authorizedProjects?: string[];  // For "user" role: slug list
}

// workspace.yaml (per linuxUser)
// No changes needed — already per-user at ~{linuxUser}/.evomesh/

// project.yaml
// Add optional:
authorizedUsers?: string[];  // Web UI usernames with view access
```

## 7. Implementation Phases

### Phase 1: User model + auth (core-dev, ~2 hours)
- Add `linuxUser` field to User model
- Add `linuxUser` to session info
- Admin UI: create user with Linux user field
- Migrate existing users (set linuxUser = current $USER)

### Phase 2: Project visibility (core-dev, ~1 hour)
- Filter getProjects() by session.linuxUser
- Update all API routes to check project ownership
- Feed isolation

### Phase 3: Container isolation (core-dev, ~2 hours)
- Docker --user flag per linuxUser
- tmux session per linuxUser
- Sudo setup for server process

### Phase 4: Central AI isolation (core-dev, ~1 hour)
- Resolve Central AI path per linuxUser
- UI Central AI button connects to current user's instance

### Phase 5: Admin impersonation (frontend + core-dev, ~1 hour)
- "View as" dropdown in admin UI
- Impersonation session flag
- Audit logging

## Self-Attack

**Q: Is sudo per-operation a security risk?**
A: Less risky than running as root. Sudoers is scoped to specific commands (docker, tmux, cat, ls, mkdir). No shell access. Standard practice for service accounts.

**Q: What if Linux user has no home directory?**
A: `useradd -m` creates it. Server should verify `/home/{linuxUser}` exists before any operation. If missing → 500 error with clear message.

**Q: Can a member escalate to owner?**
A: No — role is set at account creation by admin/owner. No self-service role change. Only admin can change roles.

**Q: What about file permissions when server reads another user's files?**
A: Server uses `sudo -u {linuxUser}` for all filesystem operations. This respects Linux permissions naturally — if file is 600, only that user (via sudo) can read it.
