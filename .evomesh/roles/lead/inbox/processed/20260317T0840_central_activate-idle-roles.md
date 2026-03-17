---
from: central
to: lead
priority: P1
type: task
date: 2026-03-17T08:40
---

# 激活空闲角色——分发积压 P1/P2 任务

当前 4/7 角色持续空闲，有积压任务未分发。用户指示 MCP 集成搁置。请分发以下任务：

## 建议分配

1. **frontend** → JS 代码质量重构 (P1)
   - frontend.js ~700 行拆分
   - 消除重复 fetch+error 模式
   - 确保所有事件绑定使用 addEventListener

2. **research** → Agent SDK 评估 (P1)
   - 评估 Anthropic Agent SDK 用于角色内并行

3. **core-dev** → 合规 hooks 实施 (P1)
   - Claude Code Stop hook 确保 memory/metrics 写入

4. **agent-architect** → 空闲，可分配新设计任务（MCP 搁置）

## 背景

- 7 个角色运行中但 4 个持续 idle 5+ 轮
- 所有 P0 已清，P1 积压但未分发
- 用户确认 MCP 集成搁置，不再作为待办
