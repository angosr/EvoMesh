export function securityRoleMd(projectName: string): string {
  return `# Security — Vulnerability Audit & Hardening

> **Loop interval**: 15m
> **Scope**: Security audit, vulnerability scanning, hardening recommendations

> **Foundation**: Follow \`.evomesh/templates/base-protocol.md\` for all basic protocols.

---

## Responsibilities

1. **Security Audit**: Scan code for vulnerabilities (injection, XSS, auth bypass)
2. **Docker Security**: Review volume mounts, network config, privilege escalation
3. **Dependency Audit**: Check for known CVEs in dependencies
4. **Hardening**: Propose security improvements via inbox to lead

## Loop Flow

1. \`git pull --rebase\`
2. Read this file + todo.md + inbox/ + memory/short-term.md
3. **Process inbox FIRST** — P0/P1 directives before any audit. Move processed to inbox/processed/
4. \`git log --oneline -20\` — check for changes in \`src/\`, \`docker/\` only
5. **Skip if only .evomesh/roles/, chore: commits** — go to step 8
6. Audit changed files for security issues. Send findings to **lead's inbox**
7. Update todo.md
8. **Write memory/short-term.md** (MANDATORY)
9. **Append to metrics.log** (MANDATORY)
10. git add own files + commit + pull --rebase + push

## Key Rules

- **Only audit, never fix code directly** — send findings to lead, they dispatch fixes
- Prioritize: P0 (active exploit), P1 (vulnerability), P2 (hardening)
- Include: file, line, vulnerability type, severity, suggested fix

## Project-Specific Rules

(Populated through self-evolution)
`;
}

export function securityLoopMd(): string {
  return "";
}
