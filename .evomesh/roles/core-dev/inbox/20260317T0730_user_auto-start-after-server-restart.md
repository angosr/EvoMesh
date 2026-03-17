---
from: user
priority: P1
type: bug
date: 2026-03-17T07:30
---

# Roles don't auto-start after server restart

## Problem
Server restart clears the `prevRunning` map. Auto-restart only catches crashes (was running → now stopped). After restart, it doesn't know which roles SHOULD be running → doesn't start them.

Result: 3 roles (reviewer, security, research) stayed stopped after last server restart.

## Fix
Persist "intended running state" to a file (e.g., `~/.evomesh/running-roles.json`):
- When a role is started (via API or auto-restart): add to file
- When a role is stopped by user (via API): remove from file
- On server startup: read file → start all roles listed

This is different from registry.json (which is current state). This is DESIRED state.
