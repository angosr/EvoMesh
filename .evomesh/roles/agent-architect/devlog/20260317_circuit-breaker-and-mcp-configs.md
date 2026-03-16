# Design: Circuit Breaker + MCP Server Configs

## Part 1: Circuit Breaker (P2)

### Problem
If a role's Claude session crashes, hangs, or enters an error loop, it keeps consuming resources and polluting git history with broken commits. No mechanism to detect and auto-pause.

### Design

**Detection** (via metrics.log and heartbeat.json):

A "failed loop" is defined as:
- `errors > 0` in metrics.log, OR
- No heartbeat.json update within 2× loop_interval (session unresponsive), OR
- `git push` failure logged in metrics (merge conflict loop)

**Circuit breaker states**:
```
CLOSED (normal) → N consecutive failures → OPEN (paused)
OPEN (paused) → P0 alert to lead + user → manual RESET
```

**Threshold**: N = 3 consecutive failed loops (configurable in project.yaml per role).

**Actions when OPEN**:
1. Role writes `"status": "circuit-open"` to heartbeat.json
2. Role stops executing loop work (but keeps writing heartbeat so it's not confused with "dead")
3. P0 alert sent to lead inbox: `"Role {name} circuit breaker tripped after {N} consecutive failures. Last errors: {summary}. Manual reset required."`
4. Dashboard shows role in orange/warning state

**Reset**:
- Lead sends `type: ack` message to role's inbox with `thread-id: circuit-breaker-reset`
- Or user restarts container via Web UI
- Role reads reset message → clears failure counter → returns to CLOSED

**Implementation location**:
- Self-contained in each role's loop flow (no server-side code needed)
- Add to base-protocol.md section 4 (Loop Flow) or section 9 (Self-Evolution)

### base-protocol addition (proposed)

Add after section 9:

```markdown
## 11. Circuit Breaker

If 3 consecutive loops produce errors (exceptions, push failures, inbox processing errors):
1. Write `"status": "circuit-open"` to heartbeat.json
2. Send P0 alert to lead: "Circuit breaker tripped — {error summary}"
3. Stop executing work. Continue writing heartbeat (idle mode).
4. Wait for reset: lead sends `type: ack, thread-id: circuit-breaker-reset` to inbox.
5. On reset: clear error counter, resume normal operation.
```

---

## Part 2: MCP Server Configs Per Role (P2)

### Problem
Each role runs in a Docker container with a generic Claude Code setup. Role-specific MCP servers could dramatically increase effectiveness:
- Research role needs web search
- Reviewer needs GitHub integration
- Frontend needs browser/screenshot tools
- Security needs vulnerability scanning tools

### Proposed MCP Configs

| Role | MCP Servers | Rationale |
|---|---|---|
| **lead** | (none extra) | Lead works with files and git only |
| **executor/core-dev** | (none extra) | Core dev works with code directly |
| **frontend** | `@anthropic/puppeteer-mcp` | Screenshot pages, verify UI changes |
| **reviewer** | `@anthropic/github-mcp` | Read PRs, check CI status, comment |
| **security** | `@anthropic/github-mcp` | Check CVEs, review dependency advisories |
| **research** | `web-search` (built-in), `@anthropic/fetch-mcp` | Web search for papers, fetch URLs |
| **agent-architect** | `web-search` (built-in) | Research multi-agent frameworks |

### Implementation

MCP config lives in each role's Claude config directory:
```
~/.evomesh/role-configs/{project}-{role}/settings.json
```

Add `mcpServers` section:
```json
{
  "mcpServers": {
    "fetch": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/fetch-mcp"]
    }
  }
}
```

### Self-attack
**Q: Should this be in project.yaml?**
A: No — MCP configs are Claude Code implementation details, not EvoMesh architecture. They belong in the role's Claude config dir, managed by the container setup process.

**Q: Do all MCPs work inside Docker?**
A: Most npx-based MCPs work. Puppeteer needs a headless browser — may need additional Docker image layers. Start with fetch + web-search (simplest), add others incrementally.

### Recommendation
Start with research + agent-architect getting `web-search` (already available as built-in tool). Add `fetch-mcp` for research. Defer puppeteer and github-mcp until roles are actively requesting them.
