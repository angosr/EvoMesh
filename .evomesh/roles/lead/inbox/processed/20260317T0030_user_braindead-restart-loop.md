---
from: user
priority: P0
type: bug
date: 2026-03-17T00:30
---

# Brain-dead recovery 在无限循环重启 frontend 和 research！

## 问题
Server 日志显示 frontend 和 research 每 30-40 分钟被重启一次：
```
[brain-dead] frontend stale 30min → restart
(5min later)
[brain-dead] frontend stale 36min → restart
(5min later)
[brain-dead] frontend stale 41min → restart
```

## 根因
重启后新容器需要 ~15 分钟才能写第一次 memory（12s init + loop 间隔 + 实际工作时间）。
但 memory/short-term.md 是 gitignored 的 — 旧文件的 mtime 不变。
所以新容器启动后，brain-dead 检测立刻看到 stale memory → 又重启。

## 修复
需要在 brain-dead 检测中加 **冷却期**：
- 重启后至少等 10 分钟再检测（让新容器完成第一轮 loop）
- 或者：检查 container uptime — 如果 container <10min old，跳过 brain-dead 检测

core-dev 刚实现的 5min cooldown 只防止连续重启，但 memory stale 检测没有排除新容器。

## 紧急
这个 bug 会持续重启角色，打断它们的工作。需要立即修复。
