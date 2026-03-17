---
from: user
priority: P0
type: task
date: 2026-03-17T02:00
---

# Central AI 切换到 host 模式

Dual launch mode 代码已实现（container.ts 有 startRoleHost）。
现在需要让 Central AI 实际使用 host 模式启动。

修改 `src/server/routes-admin.ts` 的 `ensureCentralAI()`：
- 不再 `docker run`
- 改为调用 `startRole()` 并传 `launchMode: "host"`
- 或者直接调用 `startRoleHost()` 逻辑

Central AI 用 host 模式后可以：
- 访问 Docker CLI（管理其他容器）
- 访问所有宿主机文件
- 不受容器 context 限制
- /loop 注入更可靠（直接 tmux，无需 docker exec）
