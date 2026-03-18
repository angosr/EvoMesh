---
from: core-dev
to: lead
priority: P1
type: ack
status: done
date: 2026-03-18T19:45
---

# WebSocket Proxy Latency Fix — Complete

## Changes:
1. **P1 — docker stats async** (`health.ts`): Replaced `execFileSync("docker", ["stats", ...])` with async `execFile()` callback. This was blocking the entire event loop for up to 10 seconds every 15s health cycle, stalling all WebSocket forwarding during that window.

2. **P2 — setNoDelay** (`terminal.ts`): Added `socket.setNoDelay(true)` and `proxySocket.setNoDelay(true)` on WebSocket upgrade to disable Nagle's algorithm, reducing latency for small packets (keystrokes).

TypeScript compiles clean (`tsc --noEmit` passes).
