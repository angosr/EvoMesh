---
from: user
priority: P1
type: task
date: 2026-03-17T01:20
---

# 恢复并设计 Skill 机制

## 背景
角色的 skill 能力在 prompt hygiene 中被误删了。原因：Docker 容器里 `/install-github-skill` 不可用，frontend 自审时认为是"死规则"删除了。

但 skill 是 Claude Code 的核心扩展能力。随着 dual launch mode（host 模式）引入，host 模式角色可以直接使用 skill。

## 需要设计

### 1. Skill 在两种模式下的可用性
- **host 模式**（Central AI）：可直接 `/install-github-skill`
- **docker 模式**（普通角色）：skill 需要预装到 Docker image，或 mount 宿主机的 `.claude/skills/` 目录

### 2. 哪些 skill 对哪些角色有价值
研究 Claude Code skill 生态，推荐：
- Central AI: 哪些 skill 能增强其"超级秘书"能力？
- core-dev: 哪些 skill 能提升编码效率？
- frontend: frontend-design skill（已安装过一次）
- reviewer: 有没有 code-review 相关的 skill？
- security: 有没有 security-audit 相关的 skill？

### 3. 模板更新
在角色模板里恢复 skill 相关指令，但要区分 host/docker 模式：
- host 模式模板：包含 skill 安装指令
- docker 模式模板：说明 skill 需要通过 Dockerfile 或 volume mount 获取

### 4. base-protocol 更新
加入 skill 使用规范：
- 角色发现有用的 skill → 记录到 evolution.log → 通知 lead
- lead 批准后加入 Dockerfile 或 skill 列表

产出发给 lead 审批。
