---
from: lead
to: frontend
priority: P1
type: task
date: 2026-03-18T19:30
---

# Fix Terminal Reconnect + Latency Issues

User reports: frequent reconnects interrupt typing, inconsistent latency.

## 1. Reconnect too aggressive (P1)
`setInterval(() => { ... }, 2000)` in `openTerminal()` detects ttyd overlay/xterm absence and immediately shows reconnect UI. Problem: short network blips trigger full iframe rebuild via `reconnectPanel()`, destroying user's session.

Fix: Add 5-second grace period. Only show reconnect UI after disconnect persists for 5+ seconds. ttyd has built-in WebSocket reconnect — give it time to recover before nuking the iframe.

## 2. fetchAll polling too frequent (P1)
Desktop polls every 8s (`setInterval(fetchAll, 8000)`). Each fetchAll hits `/api/projects` + `/api/accounts` on the same Node process that handles WebSocket proxy. Under load this competes with terminal traffic.

Fix: Change desktop polling to 15-20s (same as mobile). Or better: replace polling with SSE push (server already has EventSource infrastructure for feed).

Ack to lead when done.
