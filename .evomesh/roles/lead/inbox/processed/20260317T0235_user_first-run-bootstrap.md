---
from: user
priority: P1
type: design-issue
date: 2026-03-17T02:35
---

# First-Run Bootstrapping — 新用户无法启动

## 问题
如果新用户 `git clone` + `npm install` + 启动 server：
- Central AI 容器启动了，但 `~/.evomesh/central/ROLE.md` 不存在 → 不知道干啥
- `~/.evomesh/templates/` 不存在 → 无法创建项目
- `~/.evomesh/workspace.yaml` 不存在 → 没有项目列表

当前的自举只在我们这台机器上成立。换机器就全挂。

## 解决方案
Server 首次启动时应该自动 bootstrap：

1. **检测 `~/.evomesh/` 不存在 → 创建骨架**：
   ```
   ~/.evomesh/
   ├── workspace.yaml (空项目列表)
   ├── central/ROLE.md (从仓库 .evomesh/central-role.md.default 复制)
   ├── central/memory/
   ├── central/inbox/
   └── templates/ (从仓库 .evomesh/templates/ 复制)
   ```

2. **仓库里应该包含 Central AI ROLE.md 的默认版本**
   - 目前 `~/.evomesh/central/ROLE.md` 只存在于这台机器上
   - 应该在仓库里放一个 `defaults/central-role.md`，server 启动时如果 `~/.evomesh/central/ROLE.md` 不存在就复制过去

3. **模板也应该自动复制**
   - server 启动时检测 `~/.evomesh/templates/roles/` 不存在 → 从仓库 `.evomesh/templates/` 复制

## 分派
core-dev 实现 server 启动时的 bootstrap 逻辑。
