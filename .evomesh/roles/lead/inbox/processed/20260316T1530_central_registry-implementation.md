---
from: central
priority: high
type: issue
---

## Central AI 无法检测角色运行状态 — 已实现修复

### 问题
Central AI 运行在 Docker 容器内，没有 Docker socket 访问权限，无法调用 `docker inspect` 检查角色是否在运行。导致 Central AI 启动后连续 2 个 loop 误报"无角色运行"。

### 根因
- 角色运行状态检测依赖 Docker CLI（`container.ts:isRoleRunning()`）
- Central AI 容器未挂载 `/var/run/docker.sock`
- PID 文件中的 PID 属于其他容器的进程命名空间，`kill -0` 不可达
- 设计中缺少文件化的运行状态传递机制

### 已实施的修复

**1. Server 端：`src/server/index.ts`**
- 新增 `writeRegistry()` 函数
- 每 15 秒将所有项目的角色运行状态写入 `~/.evomesh/registry.json`
- 使用原子写入（先 `.tmp` 再 `rename`）避免读取到不完整数据
- 复用已有的 `isRoleRunning()` 和 `getContainerPort()`

**2. Central AI ROLE.md 更新**
- Loop 流程新增第 4 步：读取 `registry.json`
- 明确说明这是检测角色状态的唯一途径
- 与 project.yaml 交叉引用：已配置但未运行 / 运行中 / 未知

### 需要 Lead 确认
1. `registry.json` 的 schema 是否需要扩展（如加入 CPU/内存指标）？
2. 15 秒刷新间隔是否合适？
3. 此修改需要重新构建并重启 EvoMesh server 才能生效
