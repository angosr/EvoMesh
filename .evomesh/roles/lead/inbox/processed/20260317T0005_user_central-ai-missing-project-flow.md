---
from: user
priority: P1
type: task
date: 2026-03-17T00:05
---

# Central AI ROLE.md 缺少 Project Creation Flow

## 发现
agent-architect 设计了完整的项目创建流程（devlog/20260316_project-creation-flow-design.md），
你也批准了（commit 648fa3e）。模板文件也创建好了。

但 **Central AI 的 ROLE.md 从未更新**。Section VII 只有 Role Creation Flow，没有 Project Creation Flow。

Central AI 不知道：
- 怎么读模板（project.yaml.tmpl）并替换 `{project_name}` 等变量
- 怎么分析项目代码决定角色组合
- 怎么写 workspace.yaml 注册新项目
- 怎么创建角色目录结构

## 行动
把 agent-architect 的设计整合到 `~/.evomesh/central/ROLE.md`：
- 新增 Section "Project Creation Flow"
- 包含：分析项目 → 推荐角色 → 确认 → 读模板 → 替换变量 → 写文件 → 注册 workspace
- 模板变量列表：{project_name}, {created_date}, {repo_url}, {lang}, {default_account}
