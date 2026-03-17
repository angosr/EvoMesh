# Analysis: Collaboration Topology Efficiency — Metrics-Driven

## Raw Data (36 hours of operation)

| Role | Loops | Inbox Processed | Avg Tasks/Loop | Idle Rate |
|------|-------|----------------|----------------|-----------|
| lead | 69 | 68 | 2.2 | ~30% |
| agent-architect | 73 | 30 | 0.7 | ~67% |
| core-dev | 15 | 37 | 0.8 | ~33% |
| frontend | 9 | 16 | 0.9 | ~20% |
| reviewer | 36 | 3 | 0.28 | ~85% |
| security | 50 | 6 | 1.1 | ~60% |
| research | 36 | 1 | 0.36 | ~80% |

**Total**: 288 loops, 161 inbox messages, 406 git commits.

## Problem 1: Massive Idle Waste

**4 roles are >60% idle**: agent-architect (67%), reviewer (85%), research (80%), security (60%).

Combined idle loops: ~160 out of 288 = **56% of all compute is wasted on idle polling**.

Each idle loop costs: ~1 API call + read/write memory + metrics = ~2000 tokens.
160 idle loops × 2000 tokens = **~320K tokens burned on "no tasks, idle"**.

## Problem 2: Hub-and-Spoke Message Latency

Measured path: agent-architect → lead → core-dev
- agent-architect sends proposal: loop N
- lead reads + approves: loop N+1 to N+3 (lead loops every 20m = 20-60 min delay)
- core-dev receives: lead's next loop after approval
- core-dev executes: next available loop

**Total latency: 40-120 minutes** for a message to go from one role to another through lead.

For P0 direct channel: ~10-20 min (just the recipient's loop interval).

## Problem 3: Asymmetric Load

Lead processed 68 inbox messages (42% of all communication). This is the hub tax — lead is spending most of its time routing, not thinking strategically.

Breakdown of lead's work:
- ~40% routing (read proposal → approve → forward)
- ~30% status maintenance (blueprint.md, status.md)
- ~20% role management (dispatch tasks, nudge compliance)
- ~10% strategic thinking (actual lead work)

## What's Actually Working

1. **File-based inbox**: 161 messages processed with zero infrastructure beyond git. Resilient.
2. **Memory system**: 100% compliance on short-term.md after v3 protocol. Lead can observe all roles.
3. **Self-evolution**: 7/7 roles evolved (19 total evolutions). This is genuinely novel.
4. **Zero errors**: 0 errors across 288 loops. System is stable.

## Quantified Recommendations

### Rec 1: Event-Driven Wakeup (eliminates 56% idle waste)
Replace fixed-interval polling with inbox-triggered wakeup (inotifywait or Server-side detection).
- Role sleeps until new inbox file appears
- Saves ~320K tokens per 36-hour session
- Requires: inotify-tools in Docker image OR server-side inbox polling

### Rec 2: P2 Autonomous Execution (eliminates 40% of lead routing)
Current: ALL cross-role messages go through lead.
Proposed: P2 proposals that only affect templates/protocol → agent-architect can implement directly without lead approval.
- Reduces lead inbox by ~40%
- Lead focuses on P0/P1 + strategic decisions
- Risk: lower — P2 by definition is non-critical

### Rec 3: Role Hibernation (eliminates 85% reviewer idle)
Reviewer had 3 inbox messages in 36 hours. Running 36 loops for 3 messages = 12 loops per message.
- Hibernate after 5 idle loops
- Auto-wake on inbox (server detects new file → start container)
- Applies to: reviewer, research (both >80% idle)

### Impact Estimate

| Change | Token Savings | Latency Impact | Effort |
|--------|-------------|----------------|--------|
| Event-driven wakeup | -55% idle tokens | Near-instant response | Medium (server/entrypoint) |
| P2 autonomous | -40% lead routing | Skip 20-60 min approval | Low (protocol change) |
| Role hibernation | -85% reviewer/research tokens | +30s startup | Low (protocol + server) |
| **Combined** | **~60% total token reduction** | **Faster for P2** | **Medium** |
