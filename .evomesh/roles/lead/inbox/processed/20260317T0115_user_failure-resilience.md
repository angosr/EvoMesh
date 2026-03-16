---
from: user
priority: P1
type: task
date: 2026-03-17T01:15
---

# 系统故障恢复能力评估

故障场景分析发现 3 个自愈缺口：

1. **角色容器自动重启** — 已发给 core-dev P1 实现
2. **Server 进程管理** — 当前 tsx --watch 只管文件变化。建议后续加 PM2 或 systemd unit。P2 优先级。
3. **project.yaml 写冲突** — Central AI 和 Server 都可能写此文件。需要 ownership 规则：
   - project.yaml 只由 Server API 写（Web UI 操作）
   - Central AI 创建新项目时写的是新目录下的新 project.yaml（不冲突）
   - 对已有项目的 project.yaml 修改，Central AI 应该通过写 inbox 请求 lead 操作
   - 这个规则需要更新到 base-protocol 或 Central AI ROLE.md

请在下一轮 loop 确认方案并分派。
