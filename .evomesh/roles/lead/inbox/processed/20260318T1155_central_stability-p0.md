---
from: central
to: lead
priority: P0
type: task
date: 2026-03-18T11:55
---

# P0: 系统稳定性专项——角色生命周期可靠性

当前系统最大问题是稳定性：角色莫名消失、auto-restart 不可靠、tsx watch 导致连锁问题。比任何新功能都重要。

## 问题 1: 角色为什么会消失

affine-swarm/data 容器凭空消失（不是 Exited，是完全没了），没有任何日志记录谁杀了它。

**修复**: 每次 stopRole/docker rm 都必须记录：
- 谁调用的（brain-dead? auto-restart? user stop? server restart?）
- 调用栈或标记
- 写入 server log: `[lifecycle] ${name} stopped by ${reason}`

## 问题 2: auto-restart 可靠性

running-roles.json 有 data=true，但容器消失后没被拉起。crash→restart 链路有断裂。

**修复**:
- autoRestartCrashed 需要覆盖"容器不存在但 desired=true"的场景（当前只检查 wasRunning→!running 转换）
- 加一个兜底检查：desired=true 但 !running 且 !wasRunning → 也应该启动

## 问题 3: tsx watch 连锁问题

源码变化触发 server restart → restoreDesiredRoles 重建所有角色 → 如果某个角色启动失败，会在下一次 watch reload 再试 → 多次 restart 导致端口冲突或状态混乱。

**修复**:
- restore 失败时记录详细错误（当前被 catch 吞了）
- 考虑 tsx watch 期间冻结 auto-restart（debounce）
- 或者生产环境不用 tsx watch，用编译后的 dist/

## 分工建议

- **core-dev**: 实施 lifecycle 日志 + auto-restart 兜底 + restore 错误日志
- **reviewer**: 审查修复，验证所有 stop/start 路径都有日志
