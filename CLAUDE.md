# EvoMesh Project

A self-evolving multi-role orchestrator for Claude Code. Enables multiple AI roles to collaborate on projects autonomously.

## Project Structure
- `src/` — TypeScript source (server, CLI, process management)
- `docker/` — Container image + entrypoint for roles
- `.evomesh/` — Project config, role definitions, shared docs
- `~/.evomesh/` — Global config (workspace, templates, central AI)

## Key Rules
- Read your role's ROLE.md for specific instructions
- Follow `~/.evomesh/templates/base-protocol.md` for universal protocols
- No hardcoded values (usernames, paths, ports) — use env vars or config
- No `rm -rf`, `git push --force`, `git reset --hard`
- Commit message format: `{type}({scope}): {description}`

## Architecture
- Each role runs in a Docker container (ttyd + tmux + claude)
- Web UI at port 8123 (Express server)
- Central AI manages all projects/roles from `~/.evomesh/central/`
- File-based communication: roles use inbox/, todo.md, shared/decisions.md

## Shared Documents (read-only for non-lead roles)
- `.evomesh/blueprint.md` — Strategic direction and roadmap
- `.evomesh/status.md` — Current project status
