# EvoMesh Docker Migration — Architecture Design

## 1. Overview

Migrate from tmux + ttyd (host process) to Docker containers, eliminating all tmux-related UX issues (touch scroll, mouse mode, copy-paste conflicts, WS auth chain).

### Current vs Target Architecture

```
CURRENT:                              TARGET:
Browser                               Browser
  |                                     |
Express :8123                         Express :8123
  |                                     |
/terminal/* proxy                     /terminal/* proxy (unchanged)
  |                                     |
ttyd (host) :8124..N                  Container ttyd :7681 (mapped to host :8124..N)
  |                                     |
tmux session                          claude directly (NO tmux)
  |
claude CLI
```

Key change: **tmux eliminated**. ttyd wraps claude directly inside container.
- Native xterm.js touch scroll (no copy-mode hacks)
- Native text selection (no mouse mode conflicts)
- Simpler proxy chain (fewer failure points)

---

## 2. Docker Image

```dockerfile
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    git openssh-client curl ca-certificates ttyd \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code

ARG USER_UID=1000
ARG USER_GID=1000
RUN groupadd -g ${USER_GID} evomesh && \
    useradd -m -u ${USER_UID} -g ${USER_GID} -s /bin/bash evomesh
USER evomesh
WORKDIR /project
EXPOSE 7681

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
```

Build: `docker build --build-arg USER_UID=$(id -u) --build-arg USER_GID=$(id -g) -t evomesh-role docker/`

---

## 3. Container Naming

```
evomesh-{projectSlug}-{roleName}
```

Examples: `evomesh-evomesh-lead`, `evomesh-myapp-executor`

---

## 4. Volume Mounts

| Host | Container | Mode | Purpose |
|------|-----------|------|---------|
| `{projectRoot}` | `/project` | rw | Working directory |
| `~/.evomesh/role-configs/{slug}-{role}/` | `/home/evomesh/.claude` | rw | Claude config + session history |
| `~/.gitconfig` | `/home/evomesh/.gitconfig` | ro | Git identity |
| `~/.ssh` | `/home/evomesh/.ssh` | ro | SSH keys (git push) |

---

## 5. Per-Role Config Directory

```
~/.evomesh/role-configs/
├── evomesh-lead/
│   ├── .credentials.json      ← copied from account (e.g. ~/.claude)
│   ├── .claude.json            ← copied from account
│   ├── settings.json           ← role-specific
│   ├── history.jsonl           ← role's own (persists across account switches)
│   ├── sessions/               ← role's own
│   ├── projects/               ← role's own
│   └── .session-id             ← last session ID for --resume
├── evomesh-executor/
│   └── ...
├── myapp-lead/
│   └── ...
```

---

## 6. Account Switching

1. User switches role's account from `main` (→ `~/.claude`) to `account2` (→ `~/.claude2`)
2. Server copies only `.credentials.json` + `.claude.json` from new account to role's config dir
3. Session history (`history.jsonl`, `sessions/`) stays untouched
4. Container restart → `--resume {sessionId}` → **full context preserved**

---

## 7. Session Resume

```
Start container
  ↓
Read /home/evomesh/.claude/.session-id
  ↓
Has ID? ──Yes──→ claude --resume {id} --dangerously-skip-permissions
  │
  No
  ↓
claude --name {role} --dangerously-skip-permissions
  ↓
After /loop sent, extract session ID from history.jsonl
  ↓
Write to /home/evomesh/.claude/.session-id
```

---

## 8. Entrypoint Script

```bash
#!/bin/bash
set -e

SESSION_FILE="/home/evomesh/.claude/.session-id"
CLAUDE_ARGS="--dangerously-skip-permissions"

# Resume or fresh start
if [ -f "$SESSION_FILE" ] && [ -s "$SESSION_FILE" ]; then
  SID=$(cat "$SESSION_FILE")
  CLAUDE_ARGS="--resume $SID $CLAUDE_ARGS"
else
  CLAUDE_ARGS="--name $ROLE_NAME $CLAUDE_ARGS"
fi

# Graceful shutdown handler
cleanup() {
  # Try to save session before exit
  if [ -f "/home/evomesh/.claude/history.jsonl" ]; then
    SID=$(tail -1 /home/evomesh/.claude/history.jsonl | grep -o '"sessionId":"[^"]*"' | head -1 | cut -d'"' -f4)
    [ -n "$SID" ] && echo "$SID" > "$SESSION_FILE"
  fi
  kill -TERM $(pgrep -f "claude") 2>/dev/null
  wait
  exit 0
}
trap cleanup SIGTERM SIGINT

# Start ttyd with claude
exec ttyd \
  --writable \
  -t fontSize=14 \
  -t scrollback=10000 \
  --port 7681 \
  -- claude $CLAUDE_ARGS
```

After startup, the EvoMesh server sends `/loop` via ttyd's WebSocket (or via a separate mechanism).

---

## 9. Resource Limits

Added to `RoleConfig` in `schema.ts`:

```typescript
export interface RoleConfig {
  // ... existing fields
  memory?: string;  // "2g", "512m" → --memory
  cpus?: string;    // "1.5" → --cpus
}
```

Example project.yaml:
```yaml
roles:
  lead:
    memory: "2g"
    cpus: "1.0"
  executor:
    memory: "4g"
    cpus: "2.0"
```

---

## 10. Full docker create Command

```bash
docker create \
  --name evomesh-{slug}-{role} \
  --hostname {role} \
  -p 127.0.0.1:{hostPort}:7681 \
  -v {projectRoot}:/project:rw \
  -v ~/.evomesh/role-configs/{slug}-{role}:/home/evomesh/.claude:rw \
  -v ~/.gitconfig:/home/evomesh/.gitconfig:ro \
  -v ~/.ssh:/home/evomesh/.ssh:ro \
  -e ROLE_NAME={role} \
  -e LOOP_INTERVAL={interval} \
  -e LOOP_PROMPT="{loopPrompt}" \
  --memory {memory} \
  --cpus {cpus} \
  --restart unless-stopped \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  --network host \
  evomesh-role
```

Note: `--network host` simplifies Claude API access + git SSH.

---

## 11. Server Changes

### container.ts (replaces spawner.ts)

```typescript
interface ContainerRole {
  role: string;
  containerId: string;
  containerName: string;
  ttydPort: number;
  state: 'running' | 'stopped';
}

// Core operations
createContainer(root, roleName, roleConfig, config): ContainerRole
startContainer(containerName): void
stopContainer(containerName): void
restartContainer(containerName): void
removeContainer(containerName): void
getContainerState(containerName): 'running' | 'stopped' | 'not-found'
```

### terminal.ts changes
- `startTtyd()` → deleted (ttyd runs inside container)
- `ensureTtydRunning()` → checks container state, tracks mapped port
- Proxy logic: unchanged (still proxies to localhost:port)

### routes.ts changes
- `spawnRole()` → `createContainer()` + `startContainer()`
- `stopRole()` → `stopContainer()`
- Remove `/api/projects/:slug/roles/:name/scroll` endpoint
- Chat injection: `docker exec {name} sh -c 'echo "msg" > /proc/1/fd/0'`

---

## 12. Migration Path

### Phase 1: Build infrastructure (non-breaking)
- Create docker/, container.ts, entrypoint.sh
- Add `backend: "tmux" | "docker"` to config
- Keep spawner.ts working

### Phase 2: Feature flag
- `evomesh serve --docker` or `backend: "docker"` in project.yaml
- Both modes work simultaneously

### Phase 3: Migrate existing roles
- `evomesh migrate-to-docker` CLI command
- Creates role config dirs, copies credentials, preserves session IDs
- Switches backend to docker

### Phase 4: Remove tmux code
- Delete spawnTmux, sendScript, tmux mouse config
- Remove node-pty dependency
- Remove scroll API endpoint

---

## 13. Rollback Plan

1. Set `backend: "tmux"` in project.yaml → tmux code path reactivated
2. Copy `.session-id` from role config dir back to project role dir
3. `docker rm -f $(docker ps -aq --filter name=evomesh-)` cleanup
4. Original account dirs (`~/.claude`, `~/.claude2`) are never modified

---

## 14. Limitations

1. **Docker required** — new system dependency
2. **UID match** — container user must match host user for file permissions
3. **Image updates** — claude CLI version baked in image, rebuild to update
4. **Chat injection** — needs new mechanism (not tmux send-keys)
5. **Container startup** — ~2-3s vs tmux's ~100ms (acceptable)
6. **Claude CLI updates** — can mount host binary as alternative to image rebuild
