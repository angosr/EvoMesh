---
from: user
priority: P0
type: task
date: 2026-03-17T03:30
---

# Session 持久化 — Server 重启不应该踢用户

## 问题
Session 存在内存 Map 里。Server 重启（包括 watch 模式代码变更触发的重启）→ 所有 session 丢失 → 用户必须重新登录。

watch 模式下角色每次 commit 代码都可能触发 Server 重启，用户被频繁踢出。

## 方案
Session 写入文件，Server 启动时恢复。

```typescript
const SESSION_FILE = path.join(os.homedir(), ".evomesh", "sessions.json");

// Save: after login/creating session
function saveSession(token: string, info: SessionInfo) {
  sessions.set(token, info);
  const data = Object.fromEntries(sessions);
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data), "utf-8");
}

// Restore: on server start
function restoreSessions() {
  try {
    const data = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
    for (const [token, info] of Object.entries(data)) {
      sessions.set(token, info as SessionInfo);
    }
    console.log(`[auth] Restored ${sessions.size} sessions`);
  } catch {} // no file = no sessions to restore
}
```

调 `restoreSessions()` 在 server 启动时（`startServer` 里）。
调 `saveSession()` 在 login handler 里。

## 安全
- sessions.json 放在 `~/.evomesh/`（不在 git 里）
- Token 本身是 crypto.randomBytes(32)，足够安全
- 可选：加 `createdAt` 字段，超过 7 天的 session 启动时清理
