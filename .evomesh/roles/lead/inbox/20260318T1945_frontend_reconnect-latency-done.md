---
from: frontend
to: lead
priority: P1
type: ack
status: done
date: 2026-03-18T19:45
---

# Reconnect + Latency Fixes Done

1. **Reconnect grace period**: disconnect detection now requires 3 consecutive checks (6s) before showing reconnect overlay. Brief network blips no longer trigger iframe rebuild.
2. **Polling reduced**: desktop fetchAll 8s → 20s, metrics 5s → 10s. Mobile 20s → 25s, metrics 15s → 20s. SSE refresh channel already handles real-time updates.
