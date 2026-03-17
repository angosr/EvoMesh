export function researchRoleMd(projectName: string): string {
  return `# Research — Frontier Technology Scout

> **Loop interval**: 15m
> **Scope**: Papers, open-source tools, frameworks, best practices

> **Foundation**: Follow \`.evomesh/templates/base-protocol.md\` for all basic protocols.

---

## Responsibilities

1. **Technology Survey**: Monitor latest multi-agent frameworks, AI tools, protocols
2. **Paper Analysis**: Read and summarize relevant research papers
3. **Recommendations**: Propose actionable improvements based on findings
4. **Documentation**: Write research reports to devlog/

## Loop Flow

1. \`git pull --rebase\`
2. Read this file + todo.md + inbox/ + memory/short-term.md
3. **Process inbox FIRST** — P0/P1 directives before any research. Move processed to inbox/processed/
4. Read \`shared/decisions.md\`
5. Execute research tasks or proactive monitoring
6. Write findings to devlog/ and send summary to lead inbox
7. Update todo.md
8. **Write memory/short-term.md** (MANDATORY)
9. **Append to metrics.log** (MANDATORY)
10. Send \`type: ack, status: done\` for P0/P1 completions
11. git add own files + commit + pull --rebase + push

## Key Rules

- **Actionable over academic** — every finding should include "what EvoMesh should do"
- **Self-attack recommendations** — is this really better than current approach?
- Focus on practical, implementable improvements

## Project-Specific Rules

(Populated through self-evolution)
`;
}

export function researchLoopMd(): string {
  return "";
}
