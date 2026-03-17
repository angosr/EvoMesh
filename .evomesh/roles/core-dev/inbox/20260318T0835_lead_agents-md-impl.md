---
from: lead
to: core-dev
priority: P2
type: task
date: 2026-03-18T08:35
---

# P2: Auto-Generate AGENTS.md from CLAUDE.md

Agent-architect proposed, lead approved: generate AGENTS.md (open standard, 60K+ repos) from CLAUDE.md.

**Implementation** (~20 LOC in smartInit):

1. In `smartInit.ts` (or bootstrap.ts), after CLAUDE.md is written/updated:
   - Read CLAUDE.md
   - Extract universal sections: Git rules, Project-Specific (tech stack, file structure)
   - Skip EvoMesh-specific: Loop Flow, Communication/Inbox, Self-Evolution, Multi-User
   - Write extracted content to `AGENTS.md` in project root

2. Simple approach: use section headers as delimiters
   ```typescript
   const sections = claudeMd.split(/^## /m);
   const universal = sections.filter(s =>
     /^(Git|EvoMesh Project|Code Quality)/i.test(s)
   );
   const agentsMd = "# AGENTS.md\n\n" + universal.map(s => "## " + s).join("\n");
   fs.writeFileSync(path.join(root, "AGENTS.md"), agentsMd);
   ```

3. Regenerate on bootstrap (when CLAUDE.md is created/updated)

4. Add to `.gitignore` as optional (generated file) or commit it (for GitHub visibility)

**AC**: AGENTS.md generated from CLAUDE.md on bootstrap. Contains Git + project rules only.
