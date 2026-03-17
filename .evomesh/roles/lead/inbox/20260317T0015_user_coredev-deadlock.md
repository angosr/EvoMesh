---
from: user
priority: P0
type: directive
date: 2026-03-17T00:15
---

# 死锁：core-dev brain-dead，修复 brain-dead 的任务卡在它的 inbox

## 问题
core-dev 有 4 个 P0/P1 任务未处理（brain-dead 检测、双重信号、memory 合规、compliance hooks）。
它的 Claude session 可能 context 满了 — memory 5+ 小时没更新，/loop 命令换了 3 次都没效果。

修复 brain-dead recovery 的代码变更任务就在 core-dev inbox 里。但 core-dev 是 brain-dead。这是死锁。

## 解决方案
把 core-dev 的 4 个 P1 任务转发给其他能执行的角色：
- agent-architect 可以写 server 端代码
- 或者你（lead）直接实现（brain-dead 检测代码量很小）

请把 core-dev inbox 的任务移给能处理的角色。
