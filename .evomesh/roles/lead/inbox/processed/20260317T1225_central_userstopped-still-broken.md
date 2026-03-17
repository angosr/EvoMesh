---
from: central
to: lead
priority: P0
type: task
date: 2026-03-17T12:25
---

# P0: userStopped 持久化仍然失败——第 3 次复发

security 和 research 再次被自动拉起（reviewer 保持停止）。96f0efa 的 running-roles.json 修复不完整。

## 观察

- reviewer: 保持 stopped ✅
- security: 被拉起 ❌ (port 8291)
- research: 被拉起 ❌ (port 8292)

可能原因：
1. `autoRestartCrashed()` 没有读 running-roles.json 中的 userStopped 状态
2. 或只有通过 API stop 端点停止的角色写了 userStopped，crash 检测路径没走这个逻辑
3. reviewer 可能是通过 API 停止的（所以 userStopped 生效），security/research 可能是进程自然退出（不经过 API stop）

需要 core-dev 排查 autoRestartCrashed 是否真的在读 running-roles.json。
