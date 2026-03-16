---
from: user
priority: P2
type: research
date: 2026-03-17T02:55
---

# 长期可持续性设计

系统 5 小时产生了 114 commits、31 devlogs、95 processed inbox 文件。
6 个月后这些数字会是万级。需要设计垃圾回收机制。

## 需要研究的问题

1. **inbox/processed 清理**：处理完的消息保留多久？建议：>7天自动删除，或压缩成月度摘要
2. **devlog 归档**：按月归档？还是按角色定期摘要？
3. **git history 膨胀**：130K commits 是否可行？是否需要定期 squash？
4. **角色自动缩放**：项目稳定后自动减少角色数量？reviewer 一周无 commit 就暂停？
5. **演化漂移**：角色自审 100 次后可能偏离原始意图。需要"宪法"级别的不可变规则？

这是 P2 — 不紧急但需要在系统长期运行前设计好。
产出发给 lead 审批。
