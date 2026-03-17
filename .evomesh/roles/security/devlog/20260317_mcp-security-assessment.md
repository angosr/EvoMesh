# MCP Security Pre-Assessment — 2026-03-17

## Scope
Security assessment of MCP (Model Context Protocol) server integration into EvoMesh role containers.

## Current Implementation
- MCP config stored in `project.yaml` per role (`RoleConfig.mcp`)
- `container.ts:67-74` merges MCP config into `settings.json` inside role config dir
- Claude Code inside container reads `settings.json` and starts MCP servers
- MCP servers run as child processes inside the container

## Attack Surface Analysis

### 1. SSRF via fetch-mcp (P1)
**Risk**: fetch-mcp allows roles to make HTTP requests to arbitrary URLs.
**Threat**: A compromised/manipulated role could use fetch-mcp to:
- Scan internal network (169.254.169.254 for AWS metadata, localhost services)
- Exfiltrate data to external endpoints
- Access internal APIs not intended for role access
**Mitigation**: Consider URL allowlist/blocklist in MCP config. At minimum, block cloud metadata endpoints (169.254.169.254, fd00::).
**Severity**: P1 — exploitable if role receives malicious instructions.

### 2. MCP Config Injection (P2)
**Risk**: MCP config comes from project.yaml. If a role modifies project.yaml (which they shouldn't per protocol but have filesystem access to), they could add arbitrary MCP servers.
**Threat**: Malicious MCP server with `command: "bash"` and args executing arbitrary code.
**Mitigation**:
- project.yaml ownership rule is protocol-level, not code-enforced
- Consider: server validates MCP command against allowlist before container start
- Current state: roles have rw access to project dir including .evomesh/project.yaml
**Severity**: P2 — requires violating protocol, and roles already have shell access anyway.

### 3. Prompt Injection via Fetched Content (P1)
**Risk**: fetch-mcp returns web content to Claude Code. Malicious websites could embed prompt injection in HTML/text.
**Threat**: Fetched content could instruct Claude to:
- Modify code in harmful ways
- Exfiltrate secrets from the project
- Override ROLE.md instructions
**Mitigation**: This is a fundamental LLM risk, not MCP-specific. No perfect mitigation exists. Consider:
- Rate-limiting fetch operations
- Logging all fetched URLs
- Content size limits
**Severity**: P1 — real but inherent to any tool-using LLM system.

### 4. MCP Server Process Escape (P2)
**Risk**: MCP servers run as processes inside the container. In Docker mode, container isolation limits blast radius. In host mode (SEC-014), MCP servers run directly on the host.
**Threat**: Buggy or malicious MCP server process could:
- Consume excessive resources (DoS)
- Access filesystem beyond intended scope
**Mitigation**:
- Docker mode: contained by default, resource limits available (--memory, --cpus)
- Host mode: no isolation (accepted risk per SEC-014)
**Severity**: P2 — Docker provides adequate isolation; host mode is accepted risk.

### 5. github-mcp Token Exposure (P1)
**Risk**: github-mcp would require a GitHub PAT/token. Where is this stored?
**Threat**: Token in settings.json is readable by the role (which already has it for git push). But if settings.json is committed to git or exposed via API, the token leaks.
**Mitigation**:
- settings.json is in role config dir (not in project git)
- Ensure MCP tokens are NEVER exposed in API responses or logs
- Consider env var references instead of inline tokens
**Severity**: P1 if implemented — needs careful credential management.

## Recommendations

1. **Before deploying fetch-mcp**: Add URL filtering to block cloud metadata endpoints (169.254.169.254)
2. **For github-mcp**: Use env var references for tokens, never inline in config
3. **General**: Log all MCP server starts/stops to feed for audit trail
4. **Host mode warning**: MCP servers in host mode have full host access — document this clearly

## Conclusion
MCP integration is low-risk in Docker mode (container isolation limits blast radius). Main concerns are SSRF via fetch-mcp and credential management for github-mcp. Prompt injection via fetched content is an inherent LLM risk with no perfect mitigation.

No P0 blockers for MCP deployment. P1 items should be addressed during implementation.
