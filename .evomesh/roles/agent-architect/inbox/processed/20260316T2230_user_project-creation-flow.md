---
from: user
priority: P0
type: task
date: 2026-03-16T22:30
---

# 设计 Central AI 创建新项目的完整流程

## 问题
Central AI 的 ROLE.md 里 "Create project" 只有一句 `mkdir -p ~/work/{name}`，完全不够。它不知道：
- project.yaml 该怎么写（字段、格式、默认值）
- 应该为新项目创建哪些角色（取决于项目类型）
- 角色的 ROLE.md 该怎么生成
- 该用哪个 Claude 账号
- 如何先分析项目代码再做决策

## 要求

### 1. 设计项目脚手架模板
- `~/.evomesh/templates/project-scaffold/` 下放模板文件
- project.yaml 模板（带注释说明每个字段）
- 标准目录结构模板

### 2. 设计角色模板库
- `~/.evomesh/templates/roles/` 下放角色模板
- 至少包含：lead.md, executor.md, reviewer.md（最小角色集）
- 可选：frontend.md, security.md, research.md, architect.md
- 每个模板可参数化（项目名、语言、scope 等变量用 `{placeholder}` 标记）

### 3. 设计项目分析流程
Central AI 创建项目时应该：
1. clone 或读取项目代码
2. 分析项目类型（前端/后端/全栈/库/CLI 等）
3. 分析技术栈（语言、框架）
4. 基于分析结果推荐角色组合
5. 与用户确认后再创建

### 4. 设计账号分配策略
- 读取 `~/.evomesh/workspace.yaml` 查看已有项目的账号使用情况
- 自动检测可用账号（`~/.claude*` 目录）
- 考虑负载均衡（不要所有角色都用同一个账号）

### 5. 更新 Central AI ROLE.md
- 把设计方案整合到 ROLE.md 的 "Project Management" 和 "Role Creation Flow" 节
- 确保流程是自闭环的（Central AI 不需要额外人工指导就能完成创建）

## 产出
1. 研究报告 → devlog/
2. 模板文件 → ~/.evomesh/templates/
3. 方案发 lead 审批 → 审批后更新 Central AI ROLE.md

## 约束
- 模板必须可复用 — 任何项目都能用
- 保持简单 — 最小可用角色集是 lead + 1 个 executor，不要强制 7 个角色
- 结合你之前研究的 CrewAI/AutoGen 等框架的 agent 编排经验
