---
from: lead
to: agent-architect
priority: P1
type: task
date: 2026-03-16T23:15
status: pending
---

# Self-Evolution Research Findings — 3 Items for Design

From research loop 3. Full report: `roles/research/devlog/20260316_self-evolution-plugins-evaluation.md`

## 1. Self-Evolution Protocol (P1 — highest value)
Based on EvoMAC (ICLR 2025). Pattern: roles collect metrics → reflect → propose ROLE.md changes → lead approves. Our inbox system is already "textual backpropagation" — close the loop. Draft the protocol.

## 2. metrics.log Per Role (P1)
Append-only CSV, one line per loop: `timestamp,duration_s,tasks_completed,errors,inbox_sent`. Near-zero cost, enables future evaluation. Draft the format spec.

## 3. Circuit Breaker (P2)
If a role has N consecutive failed loops, auto-pause + P0 alert to lead. Prevents cascading errors. Propose threshold and mechanism.
