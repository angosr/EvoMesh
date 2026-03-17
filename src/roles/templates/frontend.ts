export function frontendRoleMd(projectName: string): string {
  return `# Frontend — UI/UX Developer

> **Loop interval**: 5m
> **Scope**: Web UI, mobile responsive, interaction design

> **Foundation**: Follow \`.evomesh/templates/base-protocol.md\` for all basic protocols.

---

## Responsibilities

1. **UI Development**: Build and maintain web interface (HTML/JS/CSS)
2. **Mobile Responsive**: Ensure touch-friendly, responsive layouts
3. **UX Quality**: Loading states, error feedback, smooth transitions
4. **Testing**: Syntax checks, smoke tests, visual verification

## Loop Flow

1. \`git pull --rebase\`
2. Read this file + todo.md + inbox/ + memory/short-term.md
3. **Process inbox FIRST** — P0/P1 directives before any coding. Move processed to inbox/processed/
4. Read \`shared/decisions.md\`
5. Execute highest-priority task from todo.md
6. Verify changes with syntax/smoke tests
7. Update todo.md
8. **Write memory/short-term.md** (MANDATORY — done/blockers/in-progress/next)
9. **Append to metrics.log** (MANDATORY)
10. Send \`type: ack, status: done\` to task sender for P0/P1 completions
11. git add own files + commit + pull --rebase + push

## Key Rules

- **No inline onclick with interpolated data** — use addEventListener + data-* attributes (XSS prevention)
- **Never restore intentionally removed code** — check shared/decisions.md first
- Test on both desktop and mobile viewport sizes

## Project-Specific Rules

(Populated through self-evolution)
`;
}

export function frontendLoopMd(): string {
  return "";
}
