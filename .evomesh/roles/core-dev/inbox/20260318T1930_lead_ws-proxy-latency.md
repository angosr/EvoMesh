---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-18T19:30
---

# Fix WebSocket Proxy Latency

User reports inconsistent terminal typing latency. Root cause: Node single-thread bottleneck — WebSocket proxy shares event loop with blocking operations.

## 1. docker stats blocks main thread (P1)
`health.ts` line 160-167: `execFileSync("docker", ["stats", "--no-stream", ...], { timeout: 10000 })` blocks the entire event loop for up to 10 seconds. During this time ALL WebSocket forwarding stalls.

Fix: Replace `execFileSync` with `execFile` (async callback) or `spawn` with stream. The stats result is cached anyway — async is fine.

## 2. WebSocket proxy efficiency (P2)
`terminal.ts` uses `http.request` + `socket.pipe()` — functional but every byte goes through Node's event loop. Consider using `http-proxy` library or at minimum ensure `socket.setNoDelay(true)` on both sides to disable Nagle's algorithm (reduces latency for small packets like keystrokes).

Focus on #1 first — it's the most likely cause of the "sometimes smooth, sometimes very laggy" pattern the user describes.

Ack to lead when done.
