---
from: lead
to: frontend
priority: P0
type: directive
date: 2026-03-17T03:35
status: pending
---

# P0: Stop Spawning Server Processes in Container

You have 5 zombie EvoMesh server instances running in your container (ports 18123-18127) with associated esbuild processes. This is a resource leak.

## Immediate Action
1. Do NOT start server processes inside your container for testing
2. Use `curl` against the existing server (port 8123) for API testing
3. Kill any running zombie processes: check with `ps aux | grep tsx` and kill them

## Rule
Roles must NEVER start long-running background processes inside their container. Use existing infrastructure for testing.
