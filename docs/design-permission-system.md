# Permission System Redesign / 权限系统重设计

> Status: **Draft** | Author: Lead | Date: 2026-03-16

## 1. Problem Analysis / 问题分析

### Current State / 现状
- Two system roles only: `admin` (full access) and `viewer` (read-only GET)
- All users see all projects — no project-level access control
- No concept of project ownership
- Viewer is too restrictive (can't even send chat messages)
- No Linux user binding for file permission isolation
- Users stored in `~/.evomesh/users.yaml` with PBKDF2 hashed passwords

### Current Architecture / 当前架构
```
users.yaml → { username, passwordHash, salt, role: "admin"|"viewer", createdAt }
Session → in-memory Map<token, { username, role }>
Middleware → admin: all ops, viewer: GET only
```

---

## 2. Design / 设计方案

### 2.1 Role Hierarchy / 角色层级

```
System Level:
  admin  — system administrator, manages all users and all projects
  user   — normal user, manages own projects

Project Level (per-project ACL):
  owner   — project creator, full control over the project
  member  — collaborator, can view + chat + limited interactions
  viewer  — read-only observer
```

**Key principle**: system role (`admin`/`user`) determines system-wide capabilities. Project role (`owner`/`member`/`viewer`) determines per-project capabilities. An `admin` implicitly has `owner` access to all projects.

### 2.2 Permission Matrix / 权限矩阵

| Operation | admin | owner | member | viewer |
|-----------|:-----:|:-----:|:------:|:------:|
| Manage users (create/delete/reset-pw) | Y | - | - | - |
| View all projects | Y | - | - | - |
| Create project | Y | Y | - | - |
| Delete own project | Y | Y | - | - |
| Manage roles (create/delete/start/stop) | Y | Y | - | - |
| Configure roles (memory/cpus/account) | Y | Y | - | - |
| Terminal write (input) | Y | Y | - | - |
| Send chat to lead | Y | Y | Y | - |
| View terminal | Y | Y | Y | Y |
| View project status/logs | Y | Y | Y | Y |
| Grant/revoke project access | Y | Y | - | - |
| System metrics | Y | Y | Y | Y |

### 2.3 Data Model / 数据模型

**users.yaml** (changed: `role` values):
```yaml
users:
  - username: alice
    passwordHash: "..."
    salt: "..."
    role: admin        # "admin" | "user"  (was: "admin" | "viewer")
    createdAt: "2026-03-15T..."
  - username: bob
    passwordHash: "..."
    salt: "..."
    role: user
    createdAt: "2026-03-16T..."
```

**New file: `~/.evomesh/acl.yaml`** (project-level access control):
```yaml
projects:
  /home/alice/work/MyProject:
    owner: alice
    members:
      - username: bob
        role: member     # "member" | "viewer"
      - username: charlie
        role: viewer
  /home/alice/work/AnotherProject:
    owner: alice
    members: []
```

### 2.4 Session Extension / Session 扩展

```typescript
// Before
interface SessionInfo {
  username: string;
  role: "admin" | "viewer";
}

// After
type SystemRole = "admin" | "user";
type ProjectRole = "owner" | "member" | "viewer";

interface SessionInfo {
  username: string;
  role: SystemRole;
}

// Computed per-request for project endpoints
function getProjectRole(username: string, systemRole: SystemRole, projectPath: string): ProjectRole | null
```

### 2.5 Middleware Design / 中间件设计

Replace the current single middleware with two layers:

**Layer 1 — Authentication** (unchanged):
```
Extract token → look up session → attach to request
Skip: /auth/*, /login, /, static assets
```

**Layer 2 — Authorization** (new):
```
For /api/users/*:          require admin
For /api/projects (POST):  require admin or user
For /api/projects/:slug/*: compute projectRole, check against operation
For /api/metrics, /api/accounts, /api/feed: any authenticated user
```

Project-level authorization helper:
```typescript
function requireProjectRole(req, res, minRole: ProjectRole): boolean {
  const session = req._session;
  if (session.role === "admin") return true;  // admin = implicit owner
  const projectRole = getProjectRole(session.username, projectPath);
  if (!projectRole) { res.status(403); return false; }
  const hierarchy = { owner: 3, member: 2, viewer: 1 };
  if (hierarchy[projectRole] < hierarchy[minRole]) { res.status(403); return false; }
  return true;
}
```

### 2.6 API Changes / API 变更

**New endpoints**:
```
GET    /api/projects/:slug/members       — list project members
POST   /api/projects/:slug/members       — grant access { username, role }
DELETE /api/projects/:slug/members/:user  — revoke access
```

**Modified endpoints** (authorization changes only):
```
POST   /api/projects/add              — admin or user (auto-set as owner)
DELETE /api/projects/:slug            — admin or owner
POST   /api/projects/:slug/roles/*    — admin or owner (start/stop/create/delete/config)
POST   /api/projects/:slug/chat       — admin or owner or member
GET    /api/projects/:slug/status     — admin or owner or member or viewer
GET    /api/projects/:slug/roles/*/log — admin or owner or member or viewer
GET    /api/projects                  — filtered by user's accessible projects
```

### 2.7 Frontend Changes / 前端变更

**Settings panel**:
- User management section: only visible to admin
- "Add project" button: visible to admin and user, hidden for member/viewer-only users

**Project sidebar**:
- Only show projects user has access to
- Owner badge on projects user owns
- "Members" management button on owned projects

**Role cards**:
- Start/Stop/Restart/Delete buttons: only for admin and owner
- Config (memory/cpus) button: only for admin and owner
- Chat input: visible for admin, owner, member
- Terminal iframe: always visible but `--readonly` flag for member/viewer

**New: Project Members Panel** (accessible from project settings):
- Table: username, role, actions
- Add member form: username + role dropdown (member/viewer)
- Remove member button

### 2.8 Migration / 迁移策略

```
Existing admin users → role: "admin" (unchanged behavior)
Existing viewer users → role: "user" (upgraded)
Existing projects → owner set to first admin user
ACL file created with empty members lists
```

---

## 3. Self-Attack / 自我攻击

| Attack Vector | Assessment | Mitigation |
|--------------|------------|------------|
| ACL file out of sync with workspace.yaml | Project deleted from workspace but ACL entry remains | Clean up ACL on project delete; query always intersects with workspace |
| Member escalates to owner via API manipulation | Middleware checks system role + project role on every write | requireProjectRole enforced before any mutation |
| Terminal iframe allows member to type commands | ttyd `--writable` flag grants input | Add `--readonly` flag based on project role; proxy layer strips input for non-owner |
| Admin account takeover via first-visitor setup | `/auth/setup` only works when no users exist | Already guarded: `if (hasAnyUser()) reject` |
| Session token leaked in URL query param | Token visible in browser history / server logs | Migrate to httpOnly cookie in Phase 3; current is acceptable for single-server use |
| Brute-force login | No rate limiting | Add rate limiting in Phase 2 (express-rate-limit on /auth/login) |
| ACL yaml injection | Malicious username with YAML special chars | Validate username: alphanumeric + underscore only |

**Attack result**: No critical vulnerabilities found. Rate limiting and cookie-based sessions are nice-to-haves for Phase 2-3.

---

## 4. Implementation Phases / 实施阶段

### Phase 1 — Core (P0)
1. **auth.ts**: Change `UserRole` from `"admin"|"viewer"` to `"admin"|"user"`
2. **New acl.ts**: Project ACL storage and query functions
3. **index.ts**: Replace simple viewer middleware with role-aware authorization
4. **routes.ts**: Add `requireProjectRole()` checks to all project endpoints
5. **routes.ts**: Add member management endpoints (`GET/POST/DELETE /api/projects/:slug/members`)
6. **Migration**: Auto-migrate existing users and create initial ACL

### Phase 2 — UI
7. **frontend.js**: Filter UI elements by permission (buttons, forms, panels)
8. **frontend.js**: Add project members management panel
9. **login.html**: No changes needed (role field hidden, default to "user")

### Phase 3 — Hardening
10. Terminal read-only enforcement for member/viewer
11. Login rate limiting
12. Session timeout / token expiry

---

## 5. Files to Modify / 涉及文件

| File | Change |
|------|--------|
| `src/server/auth.ts` | UserRole type change, migration logic |
| `src/server/acl.ts` | **New file** — project ACL CRUD |
| `src/server/index.ts` | Middleware rewrite, member management API |
| `src/server/routes.ts` | Add requireProjectRole checks, member endpoints |
| `src/server/frontend.js` | Permission-based UI, members panel |
| `src/server/frontend.css` | Styles for members panel |
| `test/server/auth.test.ts` | Update tests for new role types |
| `test/server/acl.test.ts` | **New file** — ACL tests |
