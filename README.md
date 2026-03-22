# EvoMesh

A self-evolving multi-agent orchestrator for [Claude Code](https://claude.com/claude-code). Multiple AI roles collaborate on projects autonomously through file-based communication, git-native workflows, and a health monitoring system — all managed from a web dashboard.

## Bootstrapped by Its Own Agents

EvoMesh is built by itself. The project started with minimal scaffolding and human guidance, then multiple AI agents collaboratively developed, tested, and refined the system through the very protocols it implements. The lead role decomposes goals into tasks, core-dev and frontend implement them, reviewer audits the results, and the cycle continues — each loop improving the codebase and the collaboration rules simultaneously.

Over time, the agents independently discovered and resolved issues: communication race conditions, health monitor false positives, context drift in long-running sessions, git workflow conflicts. They evolved their own ROLE.md rules through self-audit, pruning ineffective patterns and adding learned ones. Human intervention decreases as the system matures — the agents handle routine work, quality audits, and cross-role coordination autonomously.

Idle roles enter a low-cost mode (writing only heartbeat signals, no API calls) until another role dispatches work to their inbox. This keeps token usage proportional to actual workload.

Claude Code is the currently supported agent runtime, but the architecture is agent-agnostic. The coordination layer — file-based inbox, git-tracked state, YAML config, health monitoring — works with any AI agent that can read files, run commands, and write output. Future integrations could include other coding agents, specialized LLM tools, or custom scripts.

## How It Works

EvoMesh runs multiple Claude Code instances, each assigned a specialized role (lead, core-dev, frontend, etc.). Each role operates in a continuous loop: read instructions, do work, write status, commit, repeat. Roles communicate by writing files to each other's inbox directories. Everything is git-tracked for full auditability.

```
User ←→ Web Dashboard ←→ Express Server
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   Central AI          Docker/tmux Roles       Health Monitor
   (orchestrator)      (lead, core-dev,        (auto-restart,
                        frontend, ...)          idle cleanup,
                                                brain-dead detect)
```

### The Loop

Every role follows this cycle (configurable interval, e.g. 5-20 min):

1. `git pull --rebase` — sync with latest changes
2. Read `ROLE.md` + `inbox/` + `memory/short-term.md`
3. Process inbox tasks (P0 immediately, P1 within 2 loops)
4. Execute work (code, analysis, reviews, dispatches)
5. Write `memory/short-term.md` + `heartbeat.json` + `todo.md`
6. Commit only if real output was produced (no bookkeeping-only commits)

### Role Communication

Roles communicate through **file-based inbox messages** with YAML frontmatter:

```
.evomesh/roles/core-dev/inbox/20260317T1200_lead_new-feature.md
```

```yaml
---
from: lead
to: core-dev
priority: P0
type: task
---
# Implement feature X
```

Messages flow through the lead role (hub-and-spoke), except P0 emergencies and direct bug fixes.

## Central AI

Central AI is the **system-wide orchestrator** — a persistent Claude Code instance that oversees all projects in the workspace. It is not a per-project role; it runs once per EvoMesh installation.

**What it does:**
- **Project creation**: Analyzes codebases, recommends roles, scaffolds `.evomesh/` structure
- **Cross-project monitoring**: Reads `~/.evomesh/registry.json` every loop to check role health across all projects
- **Executive reporting**: Writes `central-status.md` — a rich summary of all projects, visible in the Feed panel
- **User command processing**: Responds to messages from the Feed panel chat interface
- **Risk detection**: Identifies stuck roles, unprocessed P0 tasks, offline accounts

**How it runs:**
- Host tmux session (not Docker) — needs access to Docker socket and all project directories
- Enabled by default, can be toggled on/off from the sidebar
- Auto-recovered by the health monitor if it crashes
- State persisted in `~/.evomesh/central/`

**Feed panel** (right sidebar): Shows real-time role activity via SSE. Users can send messages to Central AI from here. Monitor events (restart, brain-dead detection, idle cleanup) also appear in the feed.

## Health Monitor

The server runs a health monitoring loop every 15 seconds with multiple detection mechanisms:

| Mechanism | What it detects | Action |
|-----------|----------------|--------|
| **Auto-restart** | Container/session crashed while desired state says "should run" | Restart with cooldown |
| **Idle cleanup** | Role explicitly writes "No tasks, idle" 3 consecutive times | Execute configured policy (default: ignore) |
| **Token keepalive** | Account token expired (expiresAt < now) | Ping account from host to revive session |

### Safety Guarantees

- **Working roles are NEVER cleared/compacted/stopped** — only explicit "No tasks, idle" declarations trigger idle cleanup
- **Circuit breaker**: After 3 monitor-initiated restarts without new output, all actions are suspended (persisted to `~/.evomesh/monitor-state.json`)
- **Server warmup**: 5-minute quiet period after server (re)start — no idle actions
- **No tmux injection**: Monitor never sends commands into running AI sessions except for explicitly configured idle cleanup (reset/compact)

### Idle Policies (per-role, configurable)

| Policy | Behavior |
|--------|----------|
| `ignore` (default) | Do nothing — just notify in feed |
| `compact` | `/compact` — compress context, keep session |
| `reset` | `/clear` + `/loop` — fresh context, same container |

## Self-Evolution

Every 10 loops, each role audits and optimizes its own `ROLE.md`:

1. **Remove**: Dead rules that never trigger, redundant duplicates
2. **Merge**: Overlapping rules into clear statements
3. **Add**: Rules learned from repeated mistakes
4. Changes logged in `evolution.log` with evidence
5. Lead reviews and may reject changes

**Idle behavior** (when no tasks):
- **Core-dev**: Proactively audits project modules for bugs and code quality
- **Frontend**: Alternates between UX/product review and code quality audit
- **Lead**: Generates tasks from blueprint gaps, dispatches self-audits to idle roles

## Web Dashboard

Browser-based management at `http://your-server:8123`:

- **Project overview**: Role status dots (running/stopped/disabled), CPU/memory stats
- **Embedded terminals**: ttyd-powered terminals for each role, with touch scroll support
- **Feed panel**: Real-time SSE feed of role activity + monitor events + Central AI chat
- **Central AI toggle**: Enable/disable with loading animation feedback
- **Role management**: Start/stop/restart, account switching, resource config
- **Settings**: Theme (dark/light), layout (tabs/grid), system info

## Role Templates

| Role | Responsibility | Default Interval |
|------|---------------|-----------------|
| **Lead** | Strategy, task dispatch, goal generation, prompt optimization | 20m |
| **Core-Dev** | Backend, Docker, API, system architecture | 10m |
| **Frontend** | Web UI, mobile responsiveness, UX design | 15m |
| **Reviewer** | Code quality, architecture review, PR verification | 15m |
| **Security** | Vulnerability scanning, attack surface, compliance | 30m |
| **Research** | Papers, frameworks, competitive landscape | 30m |
| **Agent-Architect** | Collaboration protocols, memory design | 30m |

Custom roles: create via Central AI or add templates to `defaults/templates/roles/`.

## Quick Start

### Prerequisites

- Node.js >= 18
- Docker
- Claude Code CLI (installed and logged in)
- tmux + ttyd

### Install

```bash
git clone https://github.com/angosr/EvoMesh.git
cd EvoMesh
./setup.sh
```

### Start

```bash
npm start                    # Default port 8123
```

Open `http://your-server:8123`. Create admin account on first visit.

### Remote Access (No Public IP)

If your machine doesn't have a public IP, use a tunnel to expose the dashboard:

```bash
# Cloudflare Tunnel (recommended — free, stable, HTTPS)
cloudflared tunnel --url http://localhost:8123

# Or: ngrok
ngrok http 8123

# Or: frp (self-hosted relay)
# Configure frpc.toml to forward tcp:8123 to your frp server

# Or: Tailscale (private mesh VPN — no public exposure)
# Install on both machines, access via Tailscale IP
```

The dashboard includes auth (login page), so exposing via tunnel is safe. For production use, Cloudflare Tunnel or Tailscale is recommended over ngrok.

### Create a Project

1. Open the Feed panel (right sidebar)
2. Message Central AI: "Create a project for /path/to/my-repo"
3. Central AI analyzes the codebase, recommends roles, scaffolds everything
4. Start roles from the dashboard

## Architecture

```
~/.evomesh/                          # Global (per Linux user)
├── workspace.yaml                   # Registered projects
├── registry.json                    # Role status snapshot (updated every 15s)
├── running-roles.json               # Desired state (which roles should run)
├── monitor-state.json               # Circuit breaker state (survives restarts)
├── central-enabled.json             # Central AI on/off toggle
├── central/                         # Central AI state
│   ├── central-status.md            # Executive report (shown in feed)
│   └── inbox/                       # User commands from feed panel
├── feed.jsonl                       # Feed history (last 500 events)
└── sessions.json                    # Auth sessions

<project>/.evomesh/                  # Per-project
├── project.yaml                     # Roles, accounts, config
├── blueprint.md                     # Project vision, quality dimensions
├── status.md                        # Current state (lead maintains)
├── shared/decisions.md              # Append-only decision log
└── roles/
    └── <role>/
        ├── ROLE.md                  # Role instructions (self-evolving)
        ├── memory/short-term.md     # Loop status (overwritten each loop)
        ├── heartbeat.json           # Liveness signal
        ├── todo.md                  # Task tracking
        ├── evolution.log            # Self-evolution history
        └── inbox/                   # Messages from other roles
```

### Multi-User Isolation

Each Linux user gets isolated workspaces and containers:
- Container naming: `evomesh-{linuxUser}-{project}-{role}`
- Workspace: `~{linuxUser}/.evomesh/`
- Roles cannot access other users' files

### Multi-Account Support

Different roles can use different Claude Code accounts to spread API usage:

```yaml
accounts:
  default: ~/.claude
  "2": ~/.claude2
  "3": ~/.claude3
```

Accounts are auto-distributed via round-robin from least-loaded.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Server**: Express 5
- **Containers**: Docker (per-role isolation) or host tmux
- **Terminals**: ttyd + tmux (WebSocket proxy)
- **Auth**: PBKDF2-SHA512, session-based
- **Config**: YAML (project, workspace) + JSON (state files)
- **Real-time**: Server-Sent Events (SSE)
- **Frontend**: Vanilla HTML/JS/CSS (no framework)

## Project Structure

```
EvoMesh/
├── src/
│   ├── server/              # Express server
│   │   ├── index.ts         # Entry point, session management
│   │   ├── health.ts        # Health monitor (auto-restart, brain-dead, idle)
│   │   ├── routes.ts        # Core API routes
│   │   ├── routes-roles.ts  # Role lifecycle (start/stop/restart)
│   │   ├── routes-admin.ts  # Central AI management
│   │   ├── routes-feed.ts   # SSE feed + mission control
│   │   ├── terminal.ts      # ttyd WebSocket proxy
│   │   ├── auth.ts          # User authentication
│   │   ├── acl.ts           # Access control
│   │   └── frontend*.{js,css,html}  # Web dashboard
│   ├── process/             # Container/tmux lifecycle
│   ├── config/              # YAML schema + loader (mtime-cached)
│   ├── workspace/           # Project init, bootstrap
│   └── roles/               # Role CRUD
├── docker/                  # Dockerfile + entrypoint.sh
├── defaults/
│   ├── central-role.md      # Central AI ROLE.md
│   └── templates/           # Role + project templates
├── test/                    # Node.js test runner tests
├── CLAUDE.md                # Universal rules for all roles
└── setup.sh                 # One-click deployment
```

## Contributing

Contributions welcome. Commit convention:

```
{type}({scope}): {description}
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

## License

MIT
