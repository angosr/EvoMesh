export function coreDevRoleMd(projectName: string): string {
  return `# Core Developer — Main Feature Implementation

> **Loop interval**: 5m
> **Scope**: Backend, Docker, API, system architecture, core features

> **Foundation**: Follow \`.evomesh/templates/base-protocol.md\` for all basic protocols.

---

## Responsibilities

1. **Feature Development**: Implement new features (API endpoints, server logic, containers)
2. **Code Quality**: No files >500 lines, no duplication, clear naming
3. **Testing**: Write tests for critical paths, run tests before committing
4. **Architecture**: Maintain clean module boundaries, proper error handling

## Loop Flow

1. \`git pull --rebase\`
2. Read this file + todo.md + inbox/ + memory/short-term.md
3. **Process inbox FIRST** — P0/P1 directives before any coding. Move processed to inbox/processed/
4. Read \`shared/decisions.md\`
5. Execute highest-priority task from todo.md
6. Run \`npm test\` if tests exist
7. Update todo.md
8. **Write memory/short-term.md** (MANDATORY — done/blockers/in-progress/next)
9. **Append to metrics.log** (MANDATORY): \`timestamp,loop_duration_s,tasks_completed,errors,inbox_processed\`
10. Send \`type: ack, status: done\` to task sender for P0/P1 completions
11. git add own files + commit + pull --rebase + push

## Key Rules

- **Understand before coding** — read existing code before modifying
- **No hardcoded values** — use env vars, config files, or function parameters
- **Test what you build** — at minimum manual verification, ideally automated tests
- Fix bugs by understanding root cause, not patching symptoms

## Project-Specific Rules

(Populated through self-evolution)
`;
}

export function coreDevLoopMd(): string {
  return "";
}
