---
from: user
priority: P1
type: task
date: 2026-03-17T03:20
---

# Feed 消息持久化 — 刷新/重启后恢复历史

## 问题
右侧 feed 是纯 SSE 实时流，刷新页面后所有历史消息丢失。

## 方案
Server 端把 feed 消息写入文件，前端连接时先加载历史。

### Server
- 每条 SSE 消息同时 append 到 `~/.evomesh/feed.jsonl`（JSON Lines 格式，一行一条）
- 文件超过 500 行时截断前 250 行（保留最新 250 条）
- SSE endpoint 连接时，先发送最近 50 条历史消息

```typescript
// On SSE connect, send history first
const lines = fs.readFileSync(feedPath, "utf-8").trim().split("\n").slice(-50);
for (const line of lines) {
  res.write(`data: ${line}\n\n`);
}
```

### 前端
不需要改 — 历史消息和实时消息格式相同，appendFeedMessage 统一处理。
