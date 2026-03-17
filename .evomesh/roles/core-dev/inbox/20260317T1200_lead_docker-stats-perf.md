---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T12:00
ref: reviewer feedback on 45ad922
status: pending
---

# P1: docker stats blocking Express event loop

Reviewer P1: `docker stats --no-stream` in `/api/projects/:slug/status` uses execFileSync with 5s timeout. 7 roles = up to 35s blocking. Frontend polls every 8s → requests stack up.

## Fix
Move docker stats to the 15s registry scan loop (already periodic). Cache results in memory. API reads from cache, never calls docker stats directly.

AC: No execFileSync in API request handlers. Stats served from cache.
