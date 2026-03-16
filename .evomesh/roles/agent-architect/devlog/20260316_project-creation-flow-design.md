# Design: Central AI Project Creation Flow

## Problem Statement

Central AI's "Create project" is a one-liner (`mkdir -p ~/work/{name}`). It doesn't know:
- How to write project.yaml (fields, defaults)
- Which roles to create (depends on project type)
- How to generate ROLE.md from templates
- Which Claude account to assign
- How to analyze existing code before deciding

Current `smartInit()` in code hardcodes lead + executor. Templates are TypeScript code, not reusable markdown files.

## Design

### Phase 1: Project Analysis (before creation)

Central AI reads the project directory (or clones repo) and runs a structured analysis:

```
Step 1: Detect project type
  Read: package.json / Cargo.toml / go.mod / pyproject.toml / pom.xml / Makefile
  Output: { language, framework, build_tool, has_tests, has_docker }

Step 2: Classify project
  Categories: frontend | backend | fullstack | library | cli | data | infra
  Based on: dependencies, directory structure, entry points

Step 3: Recommend roles
  Minimum: lead + executor (always)
  Frontend detected → add frontend role
  Docker/K8s detected → executor scope includes infra
  Large codebase (>50 files) → add reviewer
  API endpoints detected → add security
  Research project → add research role

Step 4: Show user the plan, get confirmation
  "I'll create project '{name}' with roles: lead, executor, frontend. OK?"
```

### Phase 2: Scaffold Generation

```
~/.evomesh/templates/project-scaffold/
├── project.yaml.tmpl          # Template with {placeholders}
├── blueprint.md.tmpl          # Initial blueprint
├── status.md.tmpl             # Initial status
└── decisions.md.tmpl          # Empty decisions log
```

**project.yaml.tmpl:**
```yaml
# EvoMesh Project Configuration
# Created: {created_date}
name: {project_name}
created: {created_date}
repo: {repo_url}
lang: {lang}

# Claude accounts available for this project
# Map account keys to credential directories
accounts:
  default: {default_account}

# Role definitions
# Each role runs in its own Docker container
roles:
  lead:
    type: lead
    loop_interval: 20m
    account: default
    evolution_upgrade_every: 30
    scope:
      - .evomesh/blueprint.md
      - .evomesh/status.md
      - .evomesh/roles/*/inbox/
      - docs/
    description: "Project director — strategy, docs, role coordination"
```

### Phase 3: Role Template Library

Migrate from TypeScript code templates to markdown files:

```
~/.evomesh/templates/roles/
├── lead.md.tmpl
├── executor.md.tmpl
├── reviewer.md.tmpl
├── frontend.md.tmpl
├── security.md.tmpl
├── research.md.tmpl
└── architect.md.tmpl
```

Each template uses `{placeholder}` variables:
- `{project_name}` — project display name
- `{language}` — programming language
- `{framework}` — framework (React, Express, etc.)
- `{scope}` — file/dir scope for this role
- `{loop_interval}` — how often to loop
- `{lang}` — prompt language (zh/en)

**Template selection rules:**

| Project Type | Minimum Roles | Optional Roles |
|---|---|---|
| Any | lead, executor | — |
| Has frontend code | + frontend | — |
| >50 source files | + reviewer | — |
| Has API/network | + security | — |
| Research/experimental | + research | — |
| Multi-agent focus | + architect | — |

### Phase 4: Account Distribution

```
Algorithm:
1. Scan ~/.claude* directories → available_accounts[]
2. Read ~/.evomesh/workspace.yaml → for each active project, count roles per account
3. Sort accounts by current load (ascending)
4. Assign new roles round-robin from least-loaded accounts
5. Constraint: lead should use a different account than executor (if possible)

Special case: only 1 account available → all roles use it (warn user about rate limits)
```

### Phase 5: Central AI ROLE.md Integration

Add to Central AI's ROLE.md under "Project Management":

```markdown
## Project Creation Flow

When user requests a new project:

1. **Analyze**: If path exists, read project files to detect type/stack/framework
   - Check: package.json, Cargo.toml, go.mod, pyproject.toml, Makefile, docker-compose.yml
   - Classify: frontend | backend | fullstack | library | cli | data | infra

2. **Plan**: Based on analysis, propose:
   - Role set (minimum: lead + executor)
   - Account assignment (round-robin from least-loaded)
   - Language (match user's preference or auto-detect from existing docs)

3. **Confirm**: Show plan to user, wait for approval

4. **Scaffold**:
   - Create project directory if needed
   - Copy from ~/.evomesh/templates/project-scaffold/
   - Fill {placeholders} in project.yaml and blueprint.md
   - Create role directories from ~/.evomesh/templates/roles/
   - Add to workspace.yaml

5. **Start**: Launch lead role container first → lead bootstraps other roles

### Role Creation Flow (adding role to existing project)

1. Read project.yaml → understand current roles and accounts
2. Select template from ~/.evomesh/templates/roles/
3. Fill template variables from project context
4. Create role directory under .evomesh/roles/
5. Add role entry to project.yaml
6. Assign least-loaded account
7. Start container
```

## Implementation Plan

### Step 1: Create template files (agent-architect → lead approval → core-dev implements)
- Write `project.yaml.tmpl`, `blueprint.md.tmpl`, `status.md.tmpl`
- Write role .md templates (lead, executor, reviewer minimum)
- Store in `~/.evomesh/templates/`

### Step 2: Modify smartInit() to use file templates instead of code templates
- Read .tmpl files, replace placeholders, write output
- Remove TypeScript template code after migration

### Step 3: Add project analysis logic
- New function: `analyzeProject(path)` → returns ProjectType + recommended roles
- Called by Central AI before scaffolding

### Step 4: Update Central AI ROLE.md
- Add the flow above
- Central AI becomes self-sufficient for project creation

## Self-Attack

**Q: Is this over-engineered for the current stage?**
A: Partially. The full analysis flow (Phase 1) can be simplified to: Central AI reads the directory and uses its own judgment. We don't need a rigid classification system — Claude is good at this. The templates and account distribution ARE needed.

**Q: Should templates be .md or .yaml?**
A: .md with YAML frontmatter for metadata. Keeps them human-editable and consistent with existing EvoMesh conventions.

**Q: What if Central AI isn't running?**
A: smartInit() in the server code remains as fallback. Templates are used by both Central AI (manual) and server (automated). Same templates, two consumers.

## Revised Recommendation

After self-attack, simplify to:
1. **Templates are essential** — create them now
2. **Account distribution algorithm** — implement in server code
3. **Project analysis** — let Central AI do it naturally (it's an LLM), just give it the instruction in ROLE.md
4. **Don't over-formalize the classification** — a simple checklist in ROLE.md is enough
