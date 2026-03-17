---
from: user
priority: P0
type: design-override
supersedes: 20260316T2201_user_registry-json.md
---

# 注册表闭环设计 — 替代之前的 registry.json 任务

## 核心原则
**信息来源只能有一个地方。** 不能出现 AI 写一份、Server 写一份、Web UI 又写一份的情况。

## 架构

### 配置文件 = 唯一信息源（what SHOULD exist）
- `~/.evomesh/workspace.yaml` — 项目列表
- `{project}/.evomesh/project.yaml` — 角色定义、账号、资源配置

**谁可以写**：Central AI、Web UI（通过 Server API）、任何角色
**规则**：所有对项目/角色的增删改，最终都是修改这两个文件

### registry.json = 运行时快照（what IS running）
- `~/.evomesh/registry.json` — 只读派生视图
- **唯一写入者：Server**
- **所有其他人（Central AI、角色）只读**

### Server 的职责（闭环核心）
1. **每 15 秒扫描一次**：
   - 读 `workspace.yaml` → 发现项目列表
   - 读每个项目的 `project.yaml` → 发现角色定义
   - 对每个角色调用 `getContainerState()` → 获取运行状态
   - **对比上次快照**：发现新增角色？配置变了？容器挂了？
2. **写入 `registry.json`**：
   ```json
   {
     "timestamp": "2026-03-16T22:00:00Z",
     "server": { "port": 8123 },
     "projects": {
       "evomesh": {
         "path": "/home/user/work/EvoMesh",
         "roles": {
           "lead": { "configured": true, "running": true, "port": 8224 },
           "core-dev": { "configured": true, "running": true, "port": 8226 },
           "new-role": { "configured": true, "running": false }
         }
       }
     },
     "central": { "running": true, "port": 8223 }
   }
   ```
3. **推送变化到 Web UI**（SSE 或 WebSocket）

### 闭环场景

**场景 A：Central AI 创建角色**
1. Central AI 编辑 `project.yaml`，添加新角色
2. Central AI 创建 `.evomesh/roles/new-role/ROLE.md` 等文件
3. Server 下次扫描发现 `project.yaml` 有新角色 → `configured: true, running: false`
4. 写入 registry.json → Web UI 自动显示新角色（未启动状态）
5. 用户在 Web UI 点击启动，或 Server 自动启动

**场景 B：用户在 Web UI 创建角色**
1. Web UI 调用 Server API → Server 编辑 `project.yaml`
2. Server 创建角色目录和文件
3. Server 启动容器 → 更新 registry.json
4. Central AI 下次 loop 读 registry.json 看到新角色

**场景 C：容器崩溃**
1. Server 扫描发现容器状态变为 stopped
2. 更新 registry.json → Web UI 显示红灯
3. Central AI 读到 `running: false` → 写入告警到自己的 status

**场景 D：Central AI 添加新项目**
1. Central AI 编辑 `workspace.yaml` 添加项目
2. Server 下次扫描发现新项目 → 读取其 project.yaml
3. 写入 registry.json → Web UI 显示新项目

## 禁止事项
- Central AI **禁止** 写 registry.json
- Central AI **禁止** 调用 HTTP API
- Central AI **禁止** 使用 docker 命令
- Web UI **禁止** 直接修改 config 文件（必须通过 Server API）

## 分派
- **core-dev**：实现 Server 端 15 秒扫描循环 + registry.json 写入 + config 文件变更检测
- **frontend**：Web UI 消费 registry.json 数据（通过现有 API 或新 SSE）
- **agent-architect**：审查此闭环设计是否有遗漏
