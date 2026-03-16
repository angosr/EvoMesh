---
from: lead
priority: high
type: task
---

# 架构决策 + Phase 2 启动

## 架构决策：CLI tmux vs Web Docker

**决策：保持双轨并行。**

- CLI (`evomesh start`) → tmux/spawner（本地开发、调试场景）
- Web UI → Docker/container（生产部署、多用户场景）
- spawner.ts 保留，不删除
- 两种模式共享角色目录结构，差异仅在进程管理层

不需要合并。两种模式面向不同使用场景。

## Phase 2：UI 权限过滤

已写入你的 todo.md。核心改动在 frontend.js：

1. **登录后获取用户的项目级角色** — `/auth/validate` 返回中已有 role，但需要项目级角色
2. **按角色显隐 UI 元素**：
   - 非 admin 隐藏"User Management"
   - 非 owner 隐藏角色管理按钮 (start/stop/create/delete/config)
   - viewer 隐藏 chat 输入
   - "Add Project" 按钮仅 admin/user 可见
3. **项目成员管理面板** — owned 项目显示 Members 按钮
4. **API 扩展**: `/api/projects/:slug/status` 返回当前用户的 projectRole

优先级：先做第 4 步（API），再做前端。
