---
from: user
priority: P1
type: task
date: 2026-03-17T03:25
---

# Config API 支持 launch_mode 字段

`POST /api/projects/:slug/roles/:name/config` 当前只保存 memory/cpus。
增加 `launch_mode` 字段（"docker" | "host"），写入 project.yaml。

```typescript
const { memory, cpus, launch_mode } = req.body;
rc.memory = memory || undefined;
rc.cpus = cpus || undefined;
if (launch_mode === "docker" || launch_mode === "host") {
  rc.launch_mode = launch_mode;
}
```

同时 `/api/projects/:slug/status` 的返回值里增加 `launch_mode` 字段，让前端读取并显示。
