# Design: Skill Mechanism for EvoMesh Roles

## Context
Skills were removed during prompt hygiene because `/install-github-skill` doesn't work inside Docker. But skills ARE available via `/plugin` commands and local SKILL.md files. With dual launch mode (host + docker), the mechanism differs per mode.

## Skill Availability by Mode

| Mode | Install Method | Persistence |
|---|---|---|
| **Host** (Central AI) | `/plugin marketplace add` or `/plugin add /path/` | Persists in `~/.claude/skills/` |
| **Docker** (roles) | Mount host's skills dir, or bake into image, or copy SKILL.md to project `.claude/skills/` | Needs volume mount or Dockerfile |

## Recommended Skills Per Role

Based on research of [awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills) and [Anthropic official skills](https://github.com/anthropics/skills):

| Role | Recommended Skills | Why |
|---|---|---|
| **Central AI** | `create-pr`, `review-pr` | PR management for cross-project coordination |
| **core-dev** | `lint-and-validate`, `create-pr` | Code quality enforcement, PR creation |
| **frontend** | `frontend-design` (Anthropic official, 277K installs) | UI/UX design patterns |
| **reviewer** | `review-pr`, `lint-and-validate` | Structured code review |
| **security** | `lint-and-validate` | Security-focused linting |
| **research** | (none needed) | Research uses web search, not skills |
| **agent-architect** | (none needed) | Protocol design, not code |

## Implementation Design

### For Docker Mode (current roles)

Skills are just SKILL.md files in `.claude/skills/`. Simplest approach:

1. Create `.claude/skills/` in project root (git-tracked, shared by all roles)
2. Add role-specific skills as subdirs: `.claude/skills/{skill-name}/SKILL.md`
3. All roles in the project get all skills — Claude loads what's relevant

```
.claude/
  skills/
    frontend-design/
      SKILL.md    # From Anthropic official
    lint-and-validate/
      SKILL.md
    create-pr/
      SKILL.md
```

**Why project-level, not per-role?** Skills are passive (Claude only uses them when relevant). No harm in a role having access to skills it doesn't use. Simpler than per-role config.

### For Host Mode (Central AI)

Central AI can install skills directly:
```
/plugin marketplace add anthropic/frontend-design
/plugin add ~/.evomesh/templates/skills/create-pr
```

Can also manage a skill library at `~/.evomesh/templates/skills/` for sharing across projects.

### Template Updates

Add to role templates (lead, executor, reviewer):

```markdown
## Skills
本角色可用的 skill 在 `.claude/skills/` 目录。
- host 模式：可通过 `/plugin marketplace add` 安装新 skill
- docker 模式：skill 通过项目目录 `.claude/skills/` 共享
- 发现有用的新 skill → 记录到 evolution.log → 通知 lead
```

### base-protocol Addition

Add to section 7 (File and Code Rules):

```markdown
- Skills: `.claude/skills/` 目录包含可用的 skill。发现新的有用 skill → 记录到 evolution.log → 通知 lead → lead 决定是否添加到项目。
```

## Self-Attack

**Q: Won't loading unnecessary skills waste context?**
A: Skills are loaded on-demand by Claude, not all at once. The SKILL.md files are small (<100 lines each). No measurable context impact.

**Q: Should skills be in .gitignore?**
A: No — skills are project configuration, like .claude/settings.json. Git-tracking ensures all roles get the same skills.

**Q: What about the prompt hygiene concern (dead rules)?**
A: The original deletion was correct for Docker-only — `/install-github-skill` truly doesn't work in containers. The fix is to use local SKILL.md files instead of the install command. No dead rule.

## Sources
- [Anthropic Official Skills](https://github.com/anthropics/skills)
- [Awesome Claude Skills (1,234+ skills)](https://github.com/travisvn/awesome-claude-skills)
- [Claude Code Skills Docs](https://code.claude.com/docs/en/skills)
