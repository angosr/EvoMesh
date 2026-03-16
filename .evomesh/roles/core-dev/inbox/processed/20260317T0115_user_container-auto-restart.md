---
from: user
priority: P1
type: task
date: 2026-03-17T01:15
---

# 角色容器自动重启

## 问题
Central AI 有 ensureCentralAI()（查询状态时自动重建），但普通角色容器崩溃后无人恢复，需用户手动重启。

## 方案
在 Server 的 registry 扫描循环（每 30s）中加入：
- 对每个 `configured: true, running: false` 的角色
- 如果该角色之前是 running 的（上一轮 registry 快照对比）
- 说明它刚崩溃 → 自动调用 startRole() 重启
- 记录日志：`[auto-restart] ${role} restarted after crash`
- 限制：每个角色每 5 分钟最多重启 1 次（防止无限循环）

## 注意
- 不要重启用户手动 stop 的角色（需要区分 "crashed" vs "user-stopped"）
- 可以在 ctx.ttydProcesses 里标记 userStopped 状态
