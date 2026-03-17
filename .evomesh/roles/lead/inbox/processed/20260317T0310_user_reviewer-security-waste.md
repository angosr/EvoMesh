---
from: user
priority: P1
type: efficiency
date: 2026-03-17T03:10
---

# Reviewer 和 Security 96% 空转

## 数据
- Reviewer: 25 reviews, 24 "clean cycle" (96% 无效)
- Security: 19 scans, 18 "clean" (95% 无效)
- 两者 scope 重叠（都扫 src/）

## 原因
每次有 commit（包括 chore: sync、inbox 处理等非代码 commit），它们就退出 light mode 做完整 review，发现无代码变更，写 "clean cycle"。

## 建议两个修改

### 1. 优化触发条件
Reviewer/security 不应该因为非代码 commit 退出 light mode。修改 ROLE.md：
- 只有 `src/`、`docker/`、`test/` 下的文件变更才触发完整 review
- `chore:` 和 `.evomesh/roles/` 变更不触发

### 2. 考虑合并
项目稳定后，reviewer 和 security 可以合并成一个 "quality" 角色。
7 个角色对一个项目来说太多了。stable 阶段 4 个角色足够：lead + core-dev + quality + research。
这是 P2，等系统下一个大功能开发阶段再评估。
