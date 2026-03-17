# EvoMesh

基于 [Claude Code](https://claude.com/claude-code) 的自演进多角色编排框架。多个 AI 角色通过文件通信和 git 原生工作流自主协作开发项目。

[English](README.md)

## EvoMesh 是什么？

EvoMesh 不构建新的 Agent 框架，而是复用 Claude Code 的原生能力 — 运行多个实例，赋予不同角色（lead、core-dev、reviewer、security 等），通过结构化协议、共享文档和 inbox 消息机制协作。所有协作产物均由 git 跟踪，提供完整审计能力。

**核心洞察**：基于文件的通信 + git 是真正的差异化优势。没有其他多智能体框架提供 git 原生审计轨迹。这一方法已被学术研究独立验证（AgentGit, WMAC 2026）。

## 功能

- **多角色编排** — 7 种内置角色模板：lead、core-dev、frontend、reviewer、security、research、agent-architect
- **自演进协议** — 角色每 10 轮自动审查和优化自己的提示词、记忆和工作流
- **Central AI** — 超级秘书：监控所有项目、分派任务、汇报状态
- **Web 控制台** — 浏览器管理，内嵌终端，SSE 实时消息流，明暗主题切换
- **双模式启动** — Docker 容器（隔离）或宿主机 tmux（完全访问），按角色配置
- **文件通信** — inbox 消息、共享决策、任务跟踪，全部 git 跟踪
- **多项目支持** — 一个实例管理多个项目，独立角色集
- **多用户认证** — admin/owner/user 权限层级，Linux 用户隔离（多租户）
- **一键部署** — `./setup.sh` 搞定一切

## 快速开始

### 前置要求

- Node.js >= 18
- Docker
- Claude Code CLI（已安装并登录）
- tmux + ttyd（可选，用于宿主机模式）

### 安装

```bash
git clone https://github.com/angosr/EvoMesh.git
cd EvoMesh
./setup.sh
```

`setup.sh` 会安装依赖、构建 Docker 镜像，并可选配置 systemd 服务。

### 启动

```bash
npm start                    # 启动服务器（默认端口 8123）
# 或
npx tsx --watch src/server/index.ts
```

浏览器打开 `http://your-server:8123`，首次访问创建管理员账户。

### 创建项目

通过 Central AI（右侧面板聊天界面）创建项目：

1. 打开 Web 控制台
2. 在右侧面板输入："为 /path/to/my-repo 创建项目"
3. Central AI 分析代码库，推荐角色组合，自动搭建项目结构
4. 在控制台点击"启动"各角色

## 架构

```
┌─────────────────────────────────────────────────┐
│                   Web 控制台                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ 项目列表  │  │   终端面板    │  │ 实时消息流 │ │
│  └──────────┘  └──────────────┘  └───────────┘ │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│            Express 服务器 (:8123)                  │
│  认证 │ API │ 注册表(15秒) │ SSE Feed │ 代理     │
└──┬──────────────┬──────────────────┬────────────┘
   │              │                  │
   ▼              ▼                  ▼
┌────────┐  ┌──────────┐     ┌──────────────┐
│Central │  │  Docker   │     │ ~/.evomesh/  │
│  AI    │  │  容器     │     │ registry.json│
│(宿主机 │  │(每角色)   │     │ workspace.yaml│
│ tmux)  │  │ttyd+claude│     │ templates/   │
└────────┘  └──────────┘     └──────────────┘
```

### 角色通信

角色通过 **基于文件的 inbox 消息** 通信，使用 YAML 元数据：

```yaml
---
from: lead
to: core-dev
priority: P0
type: task
date: 2026-03-17T12:00
---
# 实现新功能 X
...
```

### 自演进

每 10 轮循环，每个角色会：
1. 对照性能指标审查自己的 ROLE.md
2. 提出优化建议（删除无效规则、添加经验教训）
3. 向 lead 发送提案等待审批
4. 批准的变更记录在 `evolution.log`

## 角色模板

| 角色 | 职责 | 循环间隔 |
|------|------|----------|
| **Lead** | 战略方向、任务分派、目标生成 | 10 分钟 |
| **Core-Dev** | 后端实现、Docker、API | 5 分钟 |
| **Frontend** | Web UI、移动端适配、UX | 5 分钟 |
| **Reviewer** | 代码质量、架构审查 | 10 分钟 |
| **Security** | 漏洞扫描、攻击面分析 | 15 分钟 |
| **Research** | 论文、框架、竞品分析 | 30 分钟 |
| **Agent-Architect** | 协作协议、记忆架构设计 | 30 分钟 |

可通过 Central AI 或在 `defaults/templates/roles/` 添加模板创建自定义角色。

## 配置

### 项目配置 (`.evomesh/project.yaml`)

```yaml
name: my-project
roles:
  lead:
    type: lead
    loop_interval: 10m
    account: default
    launch_mode: docker    # 或 "host"
  core-dev:
    type: worker
    loop_interval: 5m
    account: "2"
```

### 多账号支持

不同角色可使用不同的 Claude Code 账号：

```yaml
accounts:
  default: ~/.claude
  "2": ~/.claude2
  "3": ~/.claude3
```

账号自动分配 — `smartInit` 从负载最低的账号轮询分配。

## 技术栈

- **运行时**: Node.js + TypeScript
- **服务器**: Express 5
- **容器化**: Docker（按角色隔离）
- **终端**: ttyd + tmux（WebSocket）
- **认证**: PBKDF2-SHA512 + 时序安全比较
- **配置**: YAML
- **实时推送**: Server-Sent Events (SSE)
- **前端**: 原生 HTML/JS/CSS（无框架）

## 项目结构

```
EvoMesh/
├── src/                    # TypeScript 源码
│   ├── server/             # Express 服务器、路由、认证、消息流
│   ├── process/            # 容器生命周期、端口分配
│   └── config/             # 配置模式、引导启动
├── docker/                 # Dockerfile + entrypoint.sh
├── defaults/               # 默认模板（唯一信息源）
│   ├── central-role.md     # Central AI 角色定义
│   └── templates/          # 角色 + 项目脚手架模板
├── .evomesh/               # 项目专属配置和角色
├── setup.sh                # 一键部署脚本
└── CLAUDE.md               # 所有角色的通用规则
```

## 贡献

欢迎贡献。请遵循 commit 规范：

```
{type}({scope}): {description}
```

类型: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

## 许可证

MIT
