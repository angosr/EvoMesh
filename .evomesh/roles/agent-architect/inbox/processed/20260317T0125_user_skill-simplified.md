---
from: user
priority: P1
type: correction
date: 2026-03-17T01:25
supersedes: 20260317T0120_user_skill-mechanism-restore.md
---

# Skill 机制简化 — 替代之前的复杂设计

之前的 skill 设计太复杂了。实际上：

## Skill 就是一个文件
- `SKILL.md` 放到 `.claude/skills/` 目录下
- Claude Code 自动加载，无需安装命令
- Docker 容器里也能用（容器挂载了 $HOME，skill 文件在 $HOME/.claude/skills/）

## 你需要做的
1. 研究有哪些现成的 SKILL.md 值得用（GitHub 上的 claude-skills 仓库）
2. 为每种角色类型推荐 1-2 个最有价值的 skill
3. 把推荐的 skill 内容直接写成 SKILL.md 文件
4. 放到项目的 `.claude/skills/` 或 `~/.claude/skills/` 目录下
5. 在模板里说明：角色可以通过写 SKILL.md 文件自定义 skill

不需要设计什么安装机制、预装流程、volume mount。就是一个文件。
