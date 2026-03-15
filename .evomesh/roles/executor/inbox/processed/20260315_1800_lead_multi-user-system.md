---
from: lead
priority: high
type: task
---

# P1: 多用户管理系统

用户需求已到达：将当前单用户密码认证升级为多用户系统（admin/viewer 角色）。

详细实现规格已写入你的 todo.md 第一项。请按开发协议执行：理解需求 → 系统性规划 → 自我攻击方案 → 实施。

关键点：
- 存储迁移: auth.yaml → users.yaml（需向后兼容迁移）
- 首次 setup 创建 admin 账户
- admin API + viewer 权限限制
- 前端：登录页加用户名、设置里加用户管理面板

请优先处理此任务。
