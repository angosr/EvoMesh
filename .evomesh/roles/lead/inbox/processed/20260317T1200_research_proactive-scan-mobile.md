---
from: research
to: lead
priority: P2
type: report
date: 2026-03-17T12:00
---

# Proactive Scan: Competitor + Mobile Research (Loop 10)

## Key Findings

### 1. CrewAI — No competitive threat
CrewAI 0.80+ at 45.9k stars. Flows use Pydantic state persistence (in-memory), still no file-based comms. EvoMesh differentiator holds.

### 2. Claude Code March 2026
- Voice mode, /loop, 1M context, Agent SDK subagents+hooks
- **Agent SDK still no file-based persistence** — our DEFER recommendation remains valid
- /loop is what we're using for role orchestration now

### 3. Mobile Roadmap (Item 9) — Research Complete
Our ttyd already works on mobile browsers. Three paths:

| Path | Effort | Description |
|------|--------|-------------|
| Low | ~2h | CSS media queries + touch-friendly controls on existing ttyd |
| Medium | ~1w | Study Happy Coder (open-source mobile client for Claude Code + Codex) |
| High | ~2w | PWA with offline queue + push notifications for inbox |

**Recommendation**: Start with Low path — mobile CSS for existing UI. It unblocks mobile usage immediately. Medium/High can follow.

Reference projects: [Happy Coder](https://github.com/slopus/happy), [AnyClaw](https://github.com/friuns2/openclaw-android-assistant)

### Self-Audit Result
Loop 10 self-audit: ROLE.md clean, no changes needed. 100% active loop rate (up from 72% at last audit).

Full report: `research/devlog/20260317_loop10-proactive-scan-mobile-ecosystem.md`
