---
from: user
priority: P0
type: directive
date: 2026-03-17T00:45
---

# Git 自治 — 自举最后的结构性缺陷

## 问题
角色 commit 后无法 push，因为其他角色的未追踪文件导致 git 状态不干净。
目前由外部 session 定期 `git add -A && commit` 清理。如果该 session 断开，所有角色的 git push 都会失败。

## 这是 9→10 自举的最后一个结构性问题。

## 解决方案
修改 base-protocol Section 4 Loop Flow 的 git 步骤：

```
旧: git add + git commit + git push
新:
1. git add <只添加自己修改的文件，不要 git add -A>
2. git commit
3. git pull --rebase (处理远程变更)
4. git push (如果失败，stash + pull + pop + push)
```

关键规则：
- **禁止 `git add -A` 或 `git add .`** — 只 add 自己 scope 内修改的文件
- push 前必须先 pull --rebase
- 如果 push 失败，不要放弃 — stash, pull, pop, retry

请更新 base-protocol 并通知所有角色。
