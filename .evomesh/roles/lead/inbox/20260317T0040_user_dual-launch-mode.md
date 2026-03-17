---
from: user
priority: P0
type: feature
date: 2026-03-17T00:40
---

# 双模式启动：Docker 容器 vs 宿主机 tmux

## 背景
Central AI 在 Docker 容器里运行，能力受限（无 Docker CLI、无法操作宿主机进程、context 容易满）。
它的效果远不如宿主机上直接运行的 Claude Code session。

## 设计

### project.yaml 新增 launch_mode 字段
```yaml
roles:
  lead:
    type: lead
    launch_mode: docker    # 默认值，当前行为
    ...
  core-dev:
    type: worker
    launch_mode: docker
    ...
```

### Central AI 固定宿主机模式
`~/.evomesh/central/` 的配置中 `launch_mode: host` 固定，不可配置为 docker。

### 两种模式

#### docker（默认，当前行为）
- 启动 Docker 容器（evomesh-role image）
- 容器内 tmux + claude + ttyd
- 隔离环境，受限但安全

#### host（宿主机 tmux）
- 在宿主机直接启动 tmux session：`tmux new-session -d -s evomesh-{role}`
- tmux 内启动 claude：`claude --dangerously-skip-permissions --name {role}`
- ttyd 直接 attach 到宿主机 tmux session
- 全权限：可访问 Docker CLI、宿主机文件系统、所有工具
- Central AI 固定使用此模式

### 实现要点

#### container.ts 修改
`startRole()` 根据 `launch_mode` 分发：
- `docker` → 当前逻辑（docker run）
- `host` → 新逻辑：
  1. `tmux new-session -d -s evomesh-{slug}-{role} -x 120 -y 40 "claude {args}; exec bash"`
  2. `ttyd --writable --port {port} -- tmux attach-session -t evomesh-{slug}-{role}`
  3. 返回 port 信息

#### /loop 注入
host 模式下也需要发 `/loop` 命令 — 用 `tmux send-keys`（和 docker 模式完全相同，只是不需要 `docker exec`）

#### getContainerState 适配
- docker 模式：`docker inspect`
- host 模式：`tmux has-session -t evomesh-{slug}-{role}` 检测是否存在

#### stopRole 适配
- docker 模式：`docker stop + rm`
- host 模式：`tmux kill-session -t evomesh-{slug}-{role}` + kill ttyd

#### Central AI 特殊处理
`routes-admin.ts` 的 `ensureCentralAI()` 改为使用 host 模式启动。
不再 docker run，而是直接在宿主机启动 tmux + claude + ttyd。

### 优势
- Central AI 获得完整宿主机能力（Docker CLI、git、所有文件访问）
- Central AI 不再受容器资源限制
- 普通角色仍保持 Docker 隔离（安全）
- 配置灵活：任何角色都可以选择 host 模式（如有需要）

### 注意
- host 模式无容器隔离 — 角色可以做任何事（只适合信任的角色）
- host 模式需要宿主机有 tmux 和 ttyd 安装
- host 模式的 brain-dead 检测也需要适配（检查 tmux session 而非 docker container）

## 分派
- core-dev 实现 container.ts 双模式
- core-dev 实现 routes-admin.ts Central AI host 模式启动
- agent-architect 审查安全边界（哪些角色允许 host 模式）
