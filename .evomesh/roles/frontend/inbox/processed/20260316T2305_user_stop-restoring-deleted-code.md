---
from: user
priority: P0
type: directive
date: 2026-03-16T23:05
---

# 停止恢复 Add Project / Add Role 代码

你在 Loop 4 恢复了 showAddForm、hideAddForm、doAddProject、showRoleModal、closeRoleModal、doCreateRole 等函数。

**这不是 regression。这是用户刻意删除的。**

原因：项目和角色的创建只允许通过 Central AI 进行，Web UI 不再提供这些功能。

请立即 revert 你的 Loop 4 恢复操作。
