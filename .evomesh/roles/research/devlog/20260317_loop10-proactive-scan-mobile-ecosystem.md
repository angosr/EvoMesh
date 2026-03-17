# Research Report — 2026-03-17 (Loop 10)

## Proactive Scan: Competitor Updates + Mobile Roadmap Research

### 1. CrewAI (Quarterly Monitoring)

**Status**: CrewAI 0.80+ stable, 45.9k GitHub stars, 100k+ certified devs.

- **Flows**: Event-driven orchestration with Pydantic state persistence across steps
- **State management**: Still in-memory Pydantic models, NOT file-based
- **Architecture**: Hub-spoke (Crews) + DAG (Flows). No file-based comms.
- **Relevance**: EvoMesh's file-based approach remains a genuine differentiator. CrewAI's Flows add production features (retry, error handling) but don't compete on audit trail / git-native persistence.

Sources:
- [CrewAI Changelog](https://docs.crewai.com/en/changelog)
- [Multi-Agent Frameworks Comparison 2026](https://gurusup.com/blog/best-multi-agent-frameworks-2026)
- [CrewAI vs LangGraph vs AutoGen vs OpenAgents](https://openagents.org/blog/posts/2026-02-23-open-source-ai-agent-frameworks-compared)

### 2. Claude Code March 2026 Updates

Key developments:
- **Voice mode**: `/voice` command with push-to-talk (spacebar), 20 languages
- **/loop command**: Recurring tasks with cron scheduling (we're using this now!)
- **1M context window**: Opus 4.6 as default model
- **Agent SDK**: Subagents + hooks support, same core tools as Claude Code
- **ExitWorktree**: Isolated environment management tool
- **Session naming**: `claude -n "name"` + `/rename`
- **Effort levels**: Simplified to low/medium/high (removed max)

**Relevance to EvoMesh**:
- Agent SDK still doesn't have file-based persistence (our monitoring item #8) — DEFER recommendation still valid
- Voice mode could be interesting for Central AI UX (future consideration)
- /loop is directly useful for role orchestration (we're dog-fooding it)

Sources:
- [Claude Code March 2026 Updates](https://pasqualepillitteri.it/en/news/381/claude-code-march-2026-updates)
- [Claude Code Changelog](https://code.claude.com/docs/en/changelog)
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)

### 3. Mobile Terminal Research (Roadmap Item 9)

**Context**: Blueprint item 9 is "Mobile app". Research on mobile terminal solutions:

**ttyd (our current stack)**:
- Already responsive, works on mobile browsers via Xterm.js + WebGL2
- WebSockets for low-latency interaction
- Supports auth (`--credential`) and SSL/TLS
- **Gap**: No mobile-specific UX (touch gestures, virtual keyboard optimization)

**Emerging mobile CLI tools (March 2026)**:
- **Happy Coder** ([github.com/slopus/happy](https://github.com/slopus/happy)): Open-source mobile+web client for Claude Code AND Codex CLI. Covers both major AI coding CLIs. Features: realtime voice, encryption.
- **CC Pocket**: Mobile app for remote AI coding agent control
- **AnyClaw** ([github.com/friuns2/openclaw-android-assistant](https://github.com/friuns2/openclaw-android-assistant)): Native Android app running OpenClaw + Codex CLI. No root, no Termux.
- **Orseni's tool**: tmux + ttyd + Tailscale stack for phone-based Codex access

**Recommendations for EvoMesh mobile (Item 9)**:
1. **Low-cost path**: Our ttyd already works on mobile. Add CSS media queries for touch-friendly controls + virtual keyboard helpers. ~1-2h frontend work.
2. **Medium path**: Study Happy Coder's architecture — it's the closest open-source reference for a multi-agent mobile client.
3. **High path**: Native PWA with offline queue + push notifications for inbox items.

Sources:
- [ttyd GitHub](https://github.com/tsl0922/ttyd)
- [3 Ways to Run Claude Code from Phone](https://zilliz.com/blog/3-easiest-ways-to-use-claude-code-on-your-mobile-phone)
- [Happy Coder](https://github.com/slopus/happy)
- [Orseni's Mobile Tool](https://medium.com/@orseni/i-wanted-to-use-codex-cli-from-my-phone-so-i-built-a-small-tool-for-that-0e46b8e184d8)

## Self-Audit (Loop 10 — every 10 loops per protocol)

**Metrics analysis (loops 1-10)**:
- Loops 1-6: Active research (P0+P1), high output
- Loop 7: AGNTCY monitoring scan
- Loop 8: Agent SDK intra-role parallelism (ad-hoc P1)
- Loop 9: Claude usage data format (ad-hoc P1)
- Loop 10: Proactive scan + self-audit
- **Active rate**: 10/10 (100%) — significant improvement from previous audit (72% idle)

**ROLE.md audit findings**:
- ✅ No dead rules — all responsibilities actively exercised
- ✅ No duplicates — previous audit already merged redundant items
- ✅ Proactive scan step working well (added in evolution log 2026-03-17T15:30)
- ✅ 65 lines — within limits
- **No changes needed** — ROLE.md is clean and functional

**Quality gate**: (a) No problem found — metrics show 100% active loops (b) N/A — no behavior change needed (c) N/A
