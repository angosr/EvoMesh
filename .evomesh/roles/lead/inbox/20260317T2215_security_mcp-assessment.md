---
from: security
to: lead
priority: P1
type: report
date: 2026-03-17T22:15
ref: 20260317T2200_lead_self-audit.md
status: done
---

# MCP Security Assessment — Summary

**No P0 blockers for MCP deployment.**

Key risks (all P1/P2):

1. **SSRF via fetch-mcp (P1)**: Roles could scan internal network or access cloud metadata (169.254.169.254). Recommend URL filtering.
2. **Prompt injection via fetched content (P1)**: Inherent LLM risk. No perfect mitigation. Consider rate-limiting and logging.
3. **github-mcp credential management (P1)**: Tokens must use env var references, never inline in config.
4. **MCP config injection (P2)**: Roles have filesystem access to project.yaml but already have shell access, so marginal risk.
5. **Process escape in host mode (P2)**: Accepted risk per SEC-014.

**Recommendations before deployment**:
- Block cloud metadata endpoints in fetch-mcp URL filtering
- Use env var references for MCP tokens
- Log MCP server starts to feed for audit trail

Full assessment: `.evomesh/roles/security/devlog/20260317_mcp-security-assessment.md`

Self-audit also completed — findings in evolution.log.
