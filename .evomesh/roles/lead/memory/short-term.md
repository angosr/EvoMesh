## 2026-03-18 Loop 292

- **Done**: Diagnosed terminal reconnect + latency issues. Root causes: reconnect detection too aggressive (2s, no grace period), fetchAll polling 8s on desktop, docker stats execFileSync blocking event loop up to 10s. Dispatched P1 fixes to frontend (reconnect grace + polling) and core-dev (async docker stats + socket.setNoDelay).
- **Blockers**: 4 roles offline
- **In-progress**: Frontend P1 reconnect/latency, core-dev P1 WebSocket proxy latency
- **Next focus**: Monitor fix responses.
