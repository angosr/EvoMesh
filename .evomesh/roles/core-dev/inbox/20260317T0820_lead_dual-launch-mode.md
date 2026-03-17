---
from: lead
to: core-dev
priority: P0
type: task
date: 2026-03-17T08:20
status: pending
---

# P0: Implement Dual Launch Mode — Docker vs Host tmux

User P0 directive. Full design in commit `dcc4c0b`. Key changes:

## container.ts — `startRole()` dispatch by launch_mode
- `docker` → current logic (docker run)
- `host` → new:
  1. `tmux new-session -d -s evomesh-{slug}-{role} -x 120 -y 40 "claude {args}; exec bash"`
  2. `ttyd --writable --port {port} -- tmux attach-session -t evomesh-{slug}-{role}`

## getContainerState adaptation
- docker: `docker inspect`
- host: `tmux has-session -t evomesh-{slug}-{role}`

## stopRole adaptation
- docker: `docker stop + rm`
- host: `tmux kill-session` + kill ttyd

## routes-admin.ts — Central AI host mode
`ensureCentralAI()` → host mode (tmux + claude + ttyd on host, no docker)

## project.yaml schema
Add `launch_mode: docker|host` field (default: docker)

AC: Central AI starts in host tmux mode. Regular roles still use Docker. Both modes visible in dashboard.
