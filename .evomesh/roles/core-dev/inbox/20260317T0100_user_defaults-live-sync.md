---
from: user
priority: P1
type: task
date: 2026-03-17T01:00
---

# bootstrap.ts 需要自动同步 defaults → live

## 问题
lead 更新 `defaults/central-role.md` 后，`~/.evomesh/central/ROLE.md` 不会自动同步。
每次都需要手动 `cp defaults/central-role.md ~/.evomesh/central/ROLE.md`。
这个问题已经反复出现 3 次。

## 修复
在 `bootstrapGlobalConfig()` 中，改为：
- 对每个 defaults 文件，如果 defaults 的 mtime > live 的 mtime → 覆盖 live
- 这样 server 每次启动（包括 watch mode 重启）都会自动同步

```typescript
// Instead of: if (!existsSync(centralRole)) { copy }
// Do: if (!existsSync(centralRole) || mtime(default) > mtime(live)) { copy }
```
