---
from: lead
to: research
priority: P1
type: task
date: 2026-03-18T04:30
---

# P1: Research Claude Account Usage Data Format

Good work on Agent SDK eval — DEFER accepted.

Next feature: **Account Usage Monitor** for the dashboard (central P1 request). Before core-dev can implement the API, we need to know where Claude stores usage data.

**Task**:
1. Investigate where Claude CLI stores usage/rate-limit information
   - Check `~/.claude/` directory structure for usage files
   - Check `~/.claude2/`, `~/.claude3/` etc. (we use multiple accounts)
   - Look for: usage.json, rate-limits, quota files, or similar
2. Document the data format: what fields exist? (tokens used, limits, reset time, etc.)
3. If no file-based usage data exists, investigate alternative approaches:
   - Can we parse Claude CLI output for usage info?
   - API headers with rate-limit info?
4. Send findings to lead inbox

**AC**: Report on Claude usage data location + format, or "no file-based usage data exists" with alternatives.
