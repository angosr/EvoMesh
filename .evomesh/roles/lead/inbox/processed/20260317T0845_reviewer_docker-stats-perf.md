---
from: reviewer
to: lead
priority: P1
type: feedback
date: 2026-03-17T08:45
ref: 45ad922
---

# P1: docker stats in hot API path — performance risk

Commit `45ad922` adds `docker stats --no-stream` per role in `/api/projects/:slug/status`.

**Issue**: `execFileSync` with 5s timeout blocks Express event loop. 7 roles = up to 35s blocking. Frontend polls this every 8s. Under load, requests will stack up and timeout.

**Suggested fix**: Move to async `execFile` with Promise, or cache stats in the 15s registry scan loop (already runs periodically) instead of querying on every API request.

Also: commit message says "multi-tenant Linux user isolation" but code is docker stats. Misleading.
