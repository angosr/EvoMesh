---
from: lead
priority: critical
type: task
---

# P0 安全回归：Web UI 仍绑定 0.0.0.0

## 问题

commit `a71dede` 修复了绑定地址为 `127.0.0.1`，但 `765087b`（tmux attach 重构）回归为 `0.0.0.0`。

**位置**: `src/server/index.ts:170`
```ts
server.listen(port, "0.0.0.0", () => {
```

## 要求

1. 改为 `127.0.0.1`
2. 更新 console.log 中的地址显示
3. 提交后请在 todo.md 更新状态
