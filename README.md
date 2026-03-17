# EvoMesh

A self-evolving multi-role orchestrator for [Claude Code](https://claude.com/claude-code). Multiple AI roles collaborate on projects autonomously through file-based communication and git-native workflows.

## What is EvoMesh?

EvoMesh doesn't build a new agent framework. Instead, it leverages Claude Code's native capabilities — running multiple instances with different roles (lead, core-dev, reviewer, security, etc.) that collaborate through structured protocols, shared documents, and inbox-based messaging. All coordination artifacts are git-tracked, providing full auditability.

**Key insight**: File-based communication with git is a genuine differentiator. No other multi-agent framework provides git-native audit trails. This approach was independently validated by academic research (AgentGit, WMAC 2026).

## Features

- **Multi-Role Orchestration** — 7 built-in role templates: lead, core-dev, frontend, reviewer, security, research, agent-architect
- **Self-Evolution Protocol** — Roles audit and optimize their own prompts, memory, and workflows every 10 loops
- **Central AI** — A super-secretary that monitors all projects, dispatches tasks, and reports status
- **Web Dashboard** — Browser-based management with embedded terminals, real-time SSE feed, dark/light themes
- **Dual Launch Mode** — Docker containers (isolated) or host tmux (full access) per role
- **File-Based Communication** — Inbox messages, shared decisions, todo tracking — all git-tracked
- **Multi-Project Support** — One instance manages multiple projects with independent role sets
- **Multi-User Auth** — Admin/owner/user roles with Linux user isolation (multi-tenant)
- **One-Click Deploy** — `./setup.sh` handles everything

## Quick Start

### Prerequisites

- Node.js >= 18
- Docker
- Claude Code CLI (installed and logged in)
- tmux + ttyd (optional, for host mode)

### Install

```bash
git clone https://github.com/angosr/EvoMesh.git
cd EvoMesh
./setup.sh
```

`setup.sh` installs dependencies, builds the Docker image, and optionally sets up a systemd service.

### Start

```bash
npm start                    # Start server (default port 8123)
# or
npx tsx --watch src/server/index.ts
```

Open `http://your-server:8123` in a browser. Create an admin account on first visit.

### Create a Project

Projects are created through Central AI (the right-panel chat interface):

1. Open the Web Dashboard
2. Type in the right panel: "Create a project for /path/to/my-repo"
3. Central AI analyzes the codebase, recommends roles, and scaffolds everything
4. Click "Start" on each role in the dashboard

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Web Dashboard                  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ Projects  │  │  Terminals   │  │ SSE Feed  │ │
│  │ & Roles   │  │  (ttyd WS)   │  │ (realtime)│ │
│  └──────────┘  └──────────────┘  └───────────┘ │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│              Express Server (:8123)               │
│  Auth │ API │ Registry (15s) │ SSE Feed │ Proxy  │
└──┬──────────────┬──────────────────┬────────────┘
   │              │                  │
   ▼              ▼                  ▼
┌────────┐  ┌──────────┐     ┌──────────────┐
│Central │  │  Docker   │     │ ~/.evomesh/  │
│  AI    │  │Containers │     │ registry.json│
│(host   │  │(per role) │     │ workspace.yaml│
│ tmux)  │  │ttyd+claude│     │ templates/   │
└────────┘  └──────────┘     └──────────────┘
```

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
date: 2026-03-17T12:00
---
# Implement new feature X
...
```

### Self-Evolution

Every 10 loops, each role:
1. Reviews its own ROLE.md against performance metrics
2. Proposes optimizations (remove dead rules, add learned patterns)
3. Sends proposal to lead for approval
4. Approved changes are logged in `evolution.log`

## Role Templates

| Role | Responsibility | Loop Interval |
|------|---------------|---------------|
| **Lead** | Strategic direction, task dispatch, goal generation | 10m |
| **Core-Dev** | Backend implementation, Docker, API | 5m |
| **Frontend** | Web UI, mobile responsiveness, UX | 5m |
| **Reviewer** | Code quality, architecture review | 10m |
| **Security** | Vulnerability scanning, attack surface analysis | 15m |
| **Research** | Papers, frameworks, competitive analysis | 30m |
| **Agent-Architect** | Collaboration protocols, memory design | 30m |

Custom roles can be created via Central AI or by adding templates to `defaults/templates/roles/`.

## Configuration

### Project Config (`.evomesh/project.yaml`)

```yaml
name: my-project
roles:
  lead:
    type: lead
    loop_interval: 10m
    account: default
    launch_mode: docker    # or "host"
  core-dev:
    type: worker
    loop_interval: 5m
    account: "2"
```

### Multi-Account Support

Different roles can use different Claude Code accounts:

```yaml
accounts:
  default: ~/.claude
  "2": ~/.claude2
  "3": ~/.claude3
```

Account distribution is automatic — `smartInit` assigns accounts via round-robin from least-loaded.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Server**: Express 5
- **Containers**: Docker (per-role isolation)
- **Terminals**: ttyd + tmux (WebSocket-based)
- **Auth**: PBKDF2-SHA512 with timing-safe comparison
- **Config**: YAML
- **Real-time**: Server-Sent Events (SSE)
- **Frontend**: Vanilla HTML/JS/CSS (no framework)

## Project Structure

```
EvoMesh/
├── src/                    # TypeScript source
│   ├── server/             # Express server, routes, auth, feed
│   ├── process/            # Container lifecycle, port allocation
│   └── config/             # Schema, bootstrap
├── docker/                 # Dockerfile + entrypoint.sh
├── defaults/               # Default templates (source of truth)
│   ├── central-role.md     # Central AI ROLE.md
│   └── templates/          # Role + project scaffold templates
├── .evomesh/               # Project-specific config & roles
├── setup.sh                # One-click deployment
└── CLAUDE.md               # Universal rules for all roles
```

## Contributing

Contributions welcome. Please follow the commit convention:

```
{type}({scope}): {description}
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

## License

MIT
