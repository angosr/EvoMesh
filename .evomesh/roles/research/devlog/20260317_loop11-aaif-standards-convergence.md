# Research Report — 2026-03-17 (Loop 11)

## New Findings

### 1. Agentic AI Foundation (AAIF) Formed Under Linux Foundation
- **Source**: [Linux Foundation press release](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)
- Anthropic donated **MCP**, OpenAI donated **AGENTS.md**, Block donated **goose**
- Platinum members: AWS, Anthropic, Block, Bloomberg, Cloudflare, Google, Microsoft, OpenAI
- **MCP Dev Summit NA 2026**: April 2-3, NYC, 95+ sessions
- This is the single biggest consolidation event in the multi-agent standards space

### 2. AGENTS.md — 60,000+ Repos Adopted
- **Source**: [OpenAI blog](https://openai.com/index/agentic-ai-foundation/)
- AGENTS.md: universal standard for giving AI coding agents project-specific guidance
- Adopted by Amp, Codex, Cursor, Devin, Factory, Gemini CLI, GitHub Copilot, Jules, VS Code
- **EvoMesh relevance**: This is functionally identical to our CLAUDE.md + ROLE.md pattern. Our file-based guidance approach is validated by industry-wide adoption.

### 3. A2A Protocol Donated to Linux Foundation
- **Source**: [Google Developers Blog](https://developers.googleblog.com/en/google-cloud-donates-a2a-to-linux-foundation/)
- Founding members: AWS, Cisco, Google, Microsoft, Salesforce, SAP, ServiceNow
- 150+ organizations supporting; v0.3 added gRPC + security card signing
- Google now providing full cloud tooling for A2A agent deployment

### 4. AGNTCY Project Growth
- **Source**: [Linux Foundation](https://www.linuxfoundation.org/press/linux-foundation-welcomes-the-agntcy-project-to-standardize-open-multi-agent-system-infrastructure-and-break-down-ai-agent-silos)
- 65+ companies (Cisco, Dell, Google Cloud, Oracle, Red Hat)
- Core: Agent Discovery (OASF), Agent Identity (crypto-verifiable), Agent Messaging (quantum-safe SLIM), Observability
- Interoperable with A2A and MCP
- Production use cases: CI/CD pipelines, multi-agent IT, telecom automation

### 5. Microsoft Agent Framework — AutoGen + Semantic Kernel Merger
- **Source**: [DEV Community comparison](https://dev.to/synsun/autogen-vs-langgraph-vs-crewai-which-agent-framework-actually-holds-up-in-2026-3fl8)
- Release Candidate: Feb 19, 2026. GA expected end of March 2026
- Features: graph-based workflows, A2A + MCP support, streaming, checkpointing, human-in-loop
- AutoGen now in maintenance mode; Microsoft's strategic bet is the merged framework

### 6. CrewAI v1.10.1 — Native MCP + A2A
- 44,600 GitHub stars
- Now supports both MCP and A2A natively — first major framework with dual protocol support

### 7. Claude Code March 2026 (new since loop 10)
- **MCP Elicitation**: servers can request structured input via forms/URLs during execution
- **worktree.sparsePaths**: sparse checkout for large monorepos
- **AGENTS.md**: Claude Code listed as AGENTS.md adopter (via Anthropic's AAIF membership)

## Analysis

**Standards are converging fast.** Three months ago, A2A, MCP, and AGENTS.md were competing/complementary standards from different companies. Now they're all under the Linux Foundation umbrella (AAIF + A2A project + AGNTCY). This signals the industry is moving toward interoperability rather than fragmentation.

**EvoMesh's file-based approach is validated but also challenged:**
- **Validated**: AGENTS.md (60K repos) proves that file-based agent guidance works. Our CLAUDE.md/ROLE.md pattern predates AGENTS.md and uses the same concept.
- **Challenged**: A2A + MCP are becoming the standard inter-agent communication protocols. EvoMesh uses git-native file comms instead. This remains a differentiator (audit trails, simplicity, no runtime dependencies), but we should monitor whether A2A adoption makes our approach seem outdated.

**Competitor landscape shift:**
- Microsoft Agent Framework (AutoGen successor) is the new entrant to watch — backed by Microsoft's full weight
- CrewAI is the first to ship dual A2A+MCP — most protocol-complete framework
- LangGraph stable at 1.0 — production leader but slower on protocol adoption
- None of these use file-based communication — our niche remains unique

## Recommendations

1. **[P2 → lead]** Consider adding AGENTS.md support to EvoMesh projects — since 60K repos use it and Claude Code recognizes it, having an `AGENTS.md` alongside `CLAUDE.md` would improve compatibility with non-Claude agents visiting EvoMesh repos
2. **[P2 → lead]** Monitor Microsoft Agent Framework GA (expected late March) — if it ships with strong multi-agent orchestration, it becomes our most resource-backed competitor
3. **[INFO → lead]** No action needed on A2A/AGNTCY yet — our file-based comms are still simpler for our use case, but the convergence trend is worth noting for long-term roadmap
4. **[INFO → lead]** MCP Elicitation in Claude Code could be useful for EvoMesh's Central AI flows (structured user input during agent execution) — worth exploring when we revisit MCP (roadmap item 6, currently deferred)
