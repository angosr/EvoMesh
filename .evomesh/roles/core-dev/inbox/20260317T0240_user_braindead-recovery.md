---
from: user
priority: P1
type: task
date: 2026-03-17T02:40
---

# Brain-Dead Role 自动恢复

## 问题
Claude Code session context 填满后，角色"活着但不工作"：
- 容器 running → 自动重启不触发
- Claude 进程 alive → 无崩溃信号
- 唯一信号：memory/short-term.md 停止更新

## 实现
在 Server 的 15 秒扫描循环中加入：

```typescript
// For each running role, check memory freshness
const stmPath = path.join(roleDir, "memory", "short-term.md");
const stmStat = fs.statSync(stmPath);
const ageMs = Date.now() - stmStat.mtimeMs;

// If memory >30min stale AND container is running → brain-dead
if (ageMs > 30 * 60 * 1000 && isRoleRunning(root, name)) {
  console.log(`[brain-dead] ${name} memory stale ${Math.round(ageMs/60000)}min, force-restarting`);
  stopRole(root, name);  // kill the brain-dead container
  // auto-restart will pick it up on next cycle (container now stopped → auto-restart triggers)
}
```

## 注意
- 30 分钟阈值（adaptive throttle 的 light mode 也会写 memory，所以 30min 足够宽松）
- 不要和 userStopped 冲突（用户手动停的不重启）
- 记录日志方便排查
- 先做 first-run bootstrap 再做这个（P1 但不 urgent）
