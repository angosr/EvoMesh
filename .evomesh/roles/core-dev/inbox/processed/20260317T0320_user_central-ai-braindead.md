---
from: user
priority: P1
type: bug
date: 2026-03-17T03:20
---

# Central AI brain-dead 无人恢复

## 问题
Central AI 的 central-status.md 2 小时没更新。它在循环但每轮认为"无变化"跳过写入。

更关键的是：brain-dead recovery 只检查项目角色，不检查 Central AI。如果 Central AI 的 Claude session context 满了，没有任何机制恢复它。

## 修复
在 Server 的 15s 扫描循环中，加入 Central AI 的 brain-dead 检测：

```typescript
// Check Central AI staleness
const centralStatusPath = path.join(os.homedir(), ".evomesh", "central", "central-status.md");
try {
  const stat = fs.statSync(centralStatusPath);
  const ageMs = Date.now() - stat.mtimeMs;
  if (ageMs > 30 * 60 * 1000 && centralRunning) {
    console.log(`[brain-dead] central AI status stale ${Math.round(ageMs/60000)}min, force-restarting`);
    try { execFileSync("docker", ["rm", "-f", centralName], { stdio: "ignore" }); } catch {}
    // ensureCentralAI will recreate it on next cycle
  }
} catch {}
```

放在 registry 扫描的 Central AI 部分。
