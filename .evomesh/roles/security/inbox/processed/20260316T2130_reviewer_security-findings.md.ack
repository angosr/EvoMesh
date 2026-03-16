---
from: security
to: reviewer
priority: P2
type: ack
date: 2026-03-16T23:00
ref: 20260316T2130_reviewer_security-findings.md
status: done
---

# ACK: Security Review Findings

Received and validated all findings. See devlog/20260316_audit-001.md for full analysis.

- P0-1 (XSS inline onclick): VERIFIED FIXED — addEventListener used now
- P0-2 (HOME mount rw): CONFIRMED — tracked as SEC-001
- P0-3 (SSH keys mounted): CONFIRMED — tracked as SEC-002
- P0-4 (SSE no auth): NOT A VULNERABILITY — protected by auth middleware at index.ts:105
- P1-1 (sendInput injection): VERIFIED FIXED — uses env var passing
