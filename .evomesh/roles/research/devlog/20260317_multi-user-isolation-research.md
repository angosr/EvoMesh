# Research Report — 2026-03-17: Multi-User Isolation (Blueprint Item 7)

## Context
Blueprint roadmap item 7 "Multi-user with Linux user isolation" has zero research. Currently EvoMesh is single-user. This report evaluates approaches for multi-tenancy.

## New Findings

### 1. Industry Pattern: Per-User Docker Containers
- [Per-User Docker Container Isolation (DEV)](https://dev.to/reeddev42/per-user-docker-container-isolation-a-pattern-for-multi-tenant-ai-agents-8eb): Standard pattern for multi-tenant AI agents — each user gets dedicated containers with resource quotas
- [Docker AI Teams](https://www.docker.com/blog/building-ai-teams-docker-sandboxes-agent/): Docker Desktop 4.60+ runs sandboxes inside microVMs for hard security boundaries
- [AWS Multi-Tenant AI](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-multitenant/enforcing-tenant-isolation.html): Tenant ID as mandatory filter on all operations

### 2. EvoMesh-Specific: We Already Have 80% of the Infrastructure
Our Docker-per-role architecture IS per-user isolation at the role level. For multi-user, we need:
- **Per-user workspace isolation**: Each user gets their own `~/.evomesh/` (already namespaced by Linux user)
- **Per-user project access**: ACL system already exists (`acl.yaml`, `acl.ts`)
- **Per-user containers**: Docker containers already run per-role. Extend to per-user-per-role with naming convention: `evomesh-{user}-{project}-{role}`

### 3. Linux User Namespace Approach
- [Docker userns-remap](https://docs.docker.com/engine/security/userns-remap/): Map container root to unprivileged host user
- [Netflix User Namespaces](https://netflixtechblog.com/evolving-container-security-with-linux-user-namespaces-afbe3308c082): Production-validated for container isolation
- Each EvoMesh user → Linux user → Docker userns remap → filesystem isolation automatic

### 4. Claude Code Security Model
- [Claude Code Security](https://code.claude.com/docs/en/security): Cloud sessions already run in isolated VMs
- [Claude Code Sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing): OS-level filesystem + network isolation
- EvoMesh's Docker containers already provide this sandboxing. Multi-user adds user-level separation on top.

### 5. ttyd Terminal Multi-User
- ttyd already supports `--credential` flag for per-connection auth
- Current EvoMesh: single auth token shared by all users
- Multi-user: each ttyd instance bound to a user's session, different ports per user

## Analysis

EvoMesh's multi-user implementation is simpler than greenfield because:
1. **Docker isolation already exists** — just need per-user container naming
2. **ACL system already exists** — just needs per-user project permissions
3. **Auth system already exists** — just needs user→Linux user mapping
4. **Central AI already per-instance** — each user gets their own Central AI

The main work is:
- Linux user creation on first Web UI registration (`useradd`)
- Container naming: `evomesh-{linuxuser}-{project}-{role}`
- Filesystem isolation: each user's `~/.evomesh/` is their Linux home
- ttyd port allocation per user (current allocatePort already handles this)
- Session isolation: user A cannot see user B's terminals

## Gap vs Competitors

| Feature | EvoMesh (current) | CrewAI | OpenHands |
|---------|-------------------|--------|-----------|
| Multi-user | Single-user only | Cloud-native multi-tenant | Single-user |
| Isolation | Docker per-role | API-level | Docker sandbox |
| Auth | Password + token | Cloud IAM | None (local) |

CrewAI has multi-tenant cloud. OpenHands is single-user like us. Adding multi-user to EvoMesh would be a unique differentiator for self-hosted deployments.

## Recommendations

1. **Phase 1 (P1)**: Linux user auto-creation on Web UI registration → core-dev
   - `useradd -m evomesh-{username}` on first login
   - Map Web UI session → Linux user
   - Container naming convention: `evomesh-{user}-{project}-{role}`

2. **Phase 2 (P2)**: Per-user filesystem isolation
   - Each user's containers mount their Linux home, not the server user's home
   - `~/.evomesh/` per user (workspace, templates, central AI all user-scoped)

3. **Phase 3 (P2)**: Session isolation in Web UI
   - User A cannot see user B's terminals or projects
   - ACL enforcement at API level (already partially implemented)

4. **Self-attack**: Is this actually needed now?
   - Current user count: 1. Multi-user is future-proofing.
   - BUT: having the architecture ready means we can demo multi-user at any time
   - Recommendation: design now, implement Phase 1 as P2, defer Phases 2-3

Sources:
- [Per-User Docker Container Isolation](https://dev.to/reeddev42/per-user-docker-container-isolation-a-pattern-for-multi-tenant-ai-agents-8eb)
- [Docker userns-remap](https://docs.docker.com/engine/security/userns-remap/)
- [Netflix User Namespaces](https://netflixtechblog.com/evolving-container-security-with-linux-user-namespaces-afbe3308c082)
- [AWS Multi-Tenant AI Agents](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-multitenant/enforcing-tenant-isolation.html)
- [Claude Code Security](https://code.claude.com/docs/en/security)
- [Claude Code Sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing)
