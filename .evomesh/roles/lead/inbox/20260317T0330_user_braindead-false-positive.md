---
from: user
priority: P0
type: bug
date: 2026-03-17T03:30
---

# Brain-dead 检测会误杀正在工作的角色

## 问题
brain-dead recovery 用 memory/short-term.md 超过 30min 未更新来判断角色 brain-dead。
但 core-dev 的 memory 291 分钟没更新，同时 24 秒前刚提交了代码。

如果 brain-dead recovery 触发 → 杀掉正在工作的 core-dev → 丢失工作进度。

## 根本原因
core-dev 不写 memory（虽然 ROLE.md 第 6 步说 mandatory）。brain-dead 检测依赖一个角色不遵守的信号。

## 修复方案
brain-dead 检测改为双重信号：
```
memory stale >30min AND 最近 30min 没有 git commit by this role
```
即：memory 过时 + 没有 commit 产出 = 真正 brain-dead。
memory 过时 + 有 commit = 角色在工作但不写 memory（不应该杀）。

检测方式：`git log --oneline --since="30 minutes ago" --grep="${roleName}"` 如果有结果 → 不是 brain-dead。
