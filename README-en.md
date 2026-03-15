# EvoMesh

A multi-role, self-evolving development framework built on Claude Code.

EvoMesh doesn't build a new agent — it reuses Claude Code's native capabilities. Through structured role templates and self-evolution protocols, multiple Claude Code instances collaborate as different roles. A Web UI provides visual management.

## Features

- **Multi-role orchestration** — Multiple Claude Code instances work in parallel as lead, executor, reviewer, etc.
- **Self-evolution protocol** — Roles can review and optimize their own prompts, memory, and workflows
- **Inter-role collaboration** — Inbox messaging, shared documents, task dispatch
- **Web Dashboard** — Manage all roles from a browser with embedded terminals and live status
- **Multi-user auth** — Admin/viewer role permissions with password authentication
- **Multi-project support** — Manage multiple projects from one instance
- **Session resume** — Automatically restore Claude Code sessions on role restart

## Installation

```bash
# Prerequisites
# - Node.js >= 20
# - Claude Code CLI (installed and logged in)
# - tmux

git clone https://github.com/angosr/EvoMesh.git
cd EvoMesh
npm install
npm link
```

## Quick Start

### Initialize a project

```bash
cd your-project
evomesh init
```

Follow the prompts to enter a project name and language (zh/en). This creates the `.evomesh/` structure and a default lead role.

### Create roles

```bash
evomesh role create executor   # Create executor role
evomesh role create reviewer   # Create reviewer role
evomesh role list              # List all roles
```

### Start roles

```bash
evomesh start              # Start all roles (tmux background)
evomesh start lead         # Start a single role
evomesh start lead --fg    # Foreground mode (for debugging)
evomesh status             # Check running status
evomesh attach lead        # Attach to a role's terminal
evomesh stop               # Stop all roles
```

### Start the Web UI

```bash
evomesh serve              # Start Web UI (default port 8080)
evomesh serve --port 3000  # Custom port
```

On first visit, you'll be prompted to create an admin account.

## Project Structure

```
your-project/
├── .evomesh/
│   ├── project.yaml          # Project configuration
│   ├── blueprint.md           # Strategic blueprint (lead-maintained)
│   ├── status.md              # Project status (lead-maintained)
│   ├── shared/                # Shared documents
│   │   ├── decisions.md       # Technical decisions
│   │   └── blockers.md        # Blockers
│   ├── devlog/                # Development logs
│   ├── runtime/               # PID files, logs
│   └── roles/
│       ├── lead/
│       │   ├── ROLE.md        # Role prompt
│       │   ├── loop.md        # Loop entry point
│       │   ├── todo.md        # Task list
│       │   ├── archive.md     # Completed tasks
│       │   ├── evolution.log  # Evolution log
│       │   ├── inbox/         # Incoming messages
│       │   └── memory/        # Short-term / long-term memory
│       ├── executor/
│       └── reviewer/
```

## Role Templates

| Role | Responsibility | Default Interval |
|------|---------------|-----------------|
| **Lead** | Strategic planning, cross-role review, task dispatch | 20 minutes |
| **Executor** | Code implementation, testing, commits | 10 minutes |
| **Reviewer** | Code review, security scanning | 15 minutes |

Each role is an independent Claude Code instance whose behavior is defined by the prompts in ROLE.md. Roles can modify their own prompts and workflows through the self-evolution protocol.

## Multi-Account Support

Different roles can use different Claude Code accounts:

```yaml
# .evomesh/project.yaml
accounts:
  main: ~/.claude
  "2": ~/.claude2

roles:
  lead:
    account: "2"
  executor:
    account: main
```

## Web UI

The Web Dashboard provides:
- Resizable 3-panel layout (project list, terminals, role status)
- Tabbed terminals (one per role)
- Multi-user authentication (admin can manage users, viewer is read-only)
- Multi-project management
- Mobile-friendly design

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Process management**: tmux + node-pty
- **Web**: Express 5 + single-file SPA
- **Terminal proxy**: ttyd + WebSocket
- **Auth**: PBKDF2-SHA512
- **Config**: YAML

## License

MIT
