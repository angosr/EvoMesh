# Proposal: Role Liveness Detection

## Problem Statement

EvoMesh currently tracks **container state** (Docker running/stopped) but has no way to determine if a role's **AI session is actually alive and working**. This creates two concrete problems:

1. **Wasted messages**: Roles send inbox messages to offline/frozen agents that will never process them
2. **False status**: Central AI and dashboard show "running" (green) for roles whose Claude session is frozen, crashed, or disconnected — misleading the user and other agents

### Current detection capability

| Scenario | Detected? |
|---|---|
| Container crashed | ✅ `docker inspect` |
| Container up, ttyd down | ✅ port check |
| Container up, Claude frozen | ❌ No mechanism |
| Claude crashed, tmux alive | ❌ No mechanism |
| Session idle (no loop running) | ❌ No mechanism |

### Where it breaks

- `isRoleRunning()` in `container.ts:242-244` only checks Docker state
- Frontend polls `/api/projects/:slug/status` every 8s, shows green dot if container runs
- No `HEALTHCHECK` in Dockerfile
- No heartbeat or watchdog

---

## Research: How Others Solve This

### AutoGen / CrewAI
- Use in-process agent objects — liveness is implicit (process alive = agent alive)
- Not directly comparable (they don't use separate containers)

### Kubernetes Model (industry standard)
- **Liveness probe**: periodic HTTP/exec check — restart if fails
- **Readiness probe**: is the service ready to accept work?
- **Startup probe**: grace period for slow-starting services

### Relevant to EvoMesh
Since each role runs Claude inside tmux inside Docker, we need a layered check:
1. Docker container running? (already have)
2. tmux session alive?
3. Claude process running?
4. Claude session responsive? (hardest — Claude Code doesn't expose a health API)

---

## Proposed Solution: File-Based Heartbeat

Given EvoMesh's file-based architecture, the simplest approach that fits the existing design:

### Mechanism

Each role writes a **heartbeat file** at the end of every loop iteration:

```
.evomesh/roles/{role}/heartbeat.json
```

```json
{
  "timestamp": "2026-03-16T22:30:00Z",
  "loop_count": 5,
  "status": "idle|working|blocked",
  "last_action": "Completed P0 assessment",
  "next_loop_eta": "2026-03-16T23:00:00Z"
}
```

### Liveness Rules

| Condition | Status | Action |
|---|---|---|
| No heartbeat file | `unknown` | Treat as offline |
| `timestamp` < now - (2 × loop_interval) | `stale` | Likely offline/frozen |
| `timestamp` < now - (4 × loop_interval) | `dead` | Definitely offline |
| `timestamp` recent + `status: working` | `alive` | Active |
| `timestamp` recent + `status: idle` | `alive-idle` | Waiting for next loop |

### Where to Check

1. **Central AI / Dashboard**: Read heartbeat files to show accurate status (alive/stale/dead instead of just running/stopped)
2. **Before sending inbox message**: Check recipient's heartbeat. If stale/dead, still send (they'll process when back) but warn the sender and flag in lead's status
3. **Lead loop**: Scan all heartbeat files. Report stale/dead roles in `status.md`. Optionally alert user

### Implementation Layers

**Layer 1 — File heartbeat** (simple, fits current architecture):
- Add heartbeat write to base-protocol.md loop template
- Add heartbeat read to status API endpoint
- Frontend shows 3-state indicator: 🟢 alive / 🟡 stale / 🔴 dead/stopped

**Layer 2 — Docker HEALTHCHECK** (defense-in-depth):
```dockerfile
HEALTHCHECK --interval=60s --timeout=10s --retries=3 \
  CMD test -f /workspace/.evomesh/roles/$ROLE/heartbeat.json && \
      find /workspace/.evomesh/roles/$ROLE/heartbeat.json -mmin -10 | grep -q .
```
This checks that the heartbeat file exists and was modified within 10 minutes.

**Layer 3 — Process watchdog** (future, optional):
- entrypoint.sh monitors Claude process inside tmux
- If Claude exits or hangs, automatically restart or alert

### Why NOT a network-based health check?
- Claude Code doesn't expose an HTTP health endpoint
- Adding one would require modifying Claude's runtime (out of scope)
- File-based approach is consistent with EvoMesh's design philosophy
- Git-trackable, no extra infrastructure

---

## Impact on Collaboration

### Inbox Routing
- Roles can check `heartbeat.json` before sending non-urgent messages
- Lead can prioritize dispatching tasks to alive roles
- Central AI shows accurate "who's actually working" status

### User Experience
- Dashboard shows meaningful status instead of misleading green dots
- User can immediately see which roles need attention (restart/investigate)
- No more wondering "is my agent doing anything?"

### Self-Bootstrapping Value
- Heartbeat data enables performance analysis (loop frequency, uptime %)
- Foundation for future auto-restart / auto-scaling decisions

---

## Expected Effort
- **Layer 1**: ~30 min core-dev work (heartbeat write in entrypoint/base-protocol, status API update, frontend indicator)
- **Layer 2**: ~10 min (Dockerfile change)
- **Layer 3**: Future scope

## Recommendation
Implement Layer 1 + 2 immediately. Add heartbeat write instruction to base-protocol.md so all roles get it automatically.
