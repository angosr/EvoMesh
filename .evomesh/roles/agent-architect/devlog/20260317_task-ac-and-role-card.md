# Design: Task Acceptance Criteria + role-card.json

## Part 1: Task Acceptance Criteria (P1)

### Problem
Tasks in todo.md have no verifiable completion criteria. A role marks a task `[x]` subjectively. Lead can't objectively verify completion without reading all the output.

### Spec

Add optional `AC:` line after each task in todo.md:

```markdown
## P0

- [ ] Implement login page
  AC: /login route returns HTML form; POST /api/login sets session cookie; invalid creds return 401
- [ ] Fix container restart bug
  AC: `docker restart evomesh-project-lead` resumes claude session without losing history
```

**Rules:**
1. `AC:` is optional but **recommended for all P1+ tasks**
2. Acceptance criteria must be **objectively verifiable** (testable commands, expected outputs, observable behavior)
3. A task is complete when ALL AC items pass
4. If AC can't be written, the task is too vague — refine it first
5. Lead should include AC when dispatching tasks via inbox

**Format:**
- Single-line: `AC: {criteria}` (for simple tasks)
- Multi-line: indent under the task line
  ```
  - [ ] Complex task
    AC: criterion 1; criterion 2; criterion 3
  ```

**Why not a separate field in inbox frontmatter?**
AC belongs with the task definition (todo.md), not the dispatch message. The inbox message describes WHAT to do; the todo entry tracks HOW to verify it's done.

### Integration with base-protocol.md

Add to Section 4 (Loop Flow), step 7:
> When adding tasks from inbox, include AC if provided. When creating own tasks, write AC for P1+ items.

---

## Part 2: role-card.json Schema (P2)

### Problem
Currently, routing a task to the right role requires reading every ROLE.md. There's no machine-readable way for Central AI or lead to discover which role can handle what. A2A protocol's Agent Card concept solves this.

### Spec

Each role has `.evomesh/roles/{name}/role-card.json`:

```json
{
  "name": "core-dev",
  "display_name": "Core Developer",
  "type": "worker",
  "status": "active",
  "loop_interval": "10m",
  "capabilities": [
    "typescript",
    "docker",
    "api-development",
    "testing",
    "debugging"
  ],
  "accepts": ["task", "feedback"],
  "scope": ["src/", "docker/", "test/"],
  "description": "Main feature development — backend, Docker, API"
}
```

### Schema

| Field | Type | Required | Description |
|---|---|---|---|
| name | string | yes | Role identifier (matches directory name) |
| display_name | string | yes | Human-readable name |
| type | "lead" \| "worker" | yes | Role type |
| status | "active" \| "idle" \| "paused" | yes | Current operational status |
| loop_interval | string | yes | Loop frequency (e.g., "10m") |
| capabilities | string[] | yes | What this role can do (tags for matching) |
| accepts | string[] | yes | Inbox message types this role processes |
| scope | string[] | yes | File/directory scope (from project.yaml) |
| description | string | yes | One-line summary |

### Use Cases

1. **Task auto-routing**: Central AI receives "fix the Docker build" → match "docker" capability → route to core-dev
2. **Capability gap detection**: No role has "mobile" capability → suggest creating one
3. **Dashboard enrichment**: Show capability tags in Mission Control
4. **Cross-project templates**: role-card.json is portable — copy to new project

### Who writes it?
- **Initially**: Generated from project.yaml role config + ROLE.md analysis (Central AI or smartInit does this)
- **Updates**: Role updates own `status` field each loop. Lead can update `capabilities` during ROLE.md evolution.

### Git tracking
Committed to git (small, infrequently changed, valuable for project understanding).

### Self-attack
**Q: Is this redundant with project.yaml?**
A: Partially — project.yaml has `scope` and `description`. But role-card.json adds `capabilities` (semantic tags for matching) and `accepts` (message routing), which project.yaml doesn't have. role-card.json is the "advertisement" a role publishes; project.yaml is the "config" the system uses to run it.

**Q: Over-engineering for 7 roles?**
A: Maybe today. But for the self-bootstrapping goal (roles creating other roles, auto-routing), machine-readable capabilities are essential. Low cost to implement now.
