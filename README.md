# EvoMesh

基于 Claude Code 的多角色自演进开发框架。

EvoMesh 不构建新 Agent，而是复用 Claude Code 的原生能力，通过结构化角色模板和自演进协议，让多个 Claude Code 实例以不同角色协作开发。提供 Web UI 进行可视化管理。

## 功能

- **多角色编排** — 多个 Claude Code 实例以 lead、executor、reviewer 等角色并行工作
- **自演进协议** — 角色可审查和优化自己的提示词、记忆和工作流程
- **角色间协作** — inbox 消息机制、共享文档、任务分派
- **Web Dashboard** — 浏览器管理所有角色，内嵌终端，实时状态
- **多用户认证** — admin/viewer 角色权限，密码认证
- **多项目支持** — 一个实例管理多个项目
- **会话恢复** — 角色重启后自动恢复 Claude Code 会话

## 安装

```bash
# 前置要求
# - Node.js >= 20
# - Claude Code CLI (已安装并登录)
# - tmux

git clone https://github.com/angosr/EvoMesh.git
cd EvoMesh
npm install
npm link
```

## 快速开始

### 初始化项目

```bash
cd your-project
evomesh init
```

按提示输入项目名称和语言（zh/en），将在当前目录创建 `.evomesh/` 结构和默认 lead 角色。

### 创建角色

```bash
evomesh role create executor   # 创建执行者角色
evomesh role create reviewer   # 创建审查者角色
evomesh role list              # 查看所有角色
```

### 启动角色

```bash
evomesh start              # 启动所有角色（tmux 后台）
evomesh start lead         # 启动单个角色
evomesh start lead --fg    # 前台模式（调试用）
evomesh status             # 查看运行状态
evomesh attach lead        # 连接到角色终端
evomesh stop               # 停止所有角色
```

### 启动 Web UI

```bash
evomesh serve              # 启动 Web 界面 (默认端口 8080)
evomesh serve --port 3000  # 指定端口
```

首次访问会要求创建管理员账户。

## 项目结构

```
your-project/
├── .evomesh/
│   ├── project.yaml          # 项目配置
│   ├── blueprint.md           # 战略蓝图 (lead 维护)
│   ├── status.md              # 项目现况 (lead 维护)
│   ├── shared/                # 共享文档
│   │   ├── decisions.md       # 技术决策
│   │   └── blockers.md        # 阻塞问题
│   ├── devlog/                # 开发日志
│   ├── runtime/               # PID 文件、日志
│   └── roles/
│       ├── lead/
│       │   ├── ROLE.md        # 角色提示词
│       │   ├── loop.md        # 循环入口
│       │   ├── todo.md        # 待办任务
│       │   ├── archive.md     # 已完成任务
│       │   ├── evolution.log  # 演进日志
│       │   ├── inbox/         # 收件箱
│       │   └── memory/        # 短期/长期记忆
│       ├── executor/
│       └── reviewer/
```

## 角色模板

| 角色 | 职责 | 默认周期 |
|------|------|----------|
| **Lead** | 战略规划、全角色审查、任务分派 | 20 分钟 |
| **Executor** | 代码实现、测试、提交 | 10 分钟 |
| **Reviewer** | 代码审查、安全扫描 | 15 分钟 |

每个角色是一个独立的 Claude Code 实例，通过 ROLE.md 中的提示词定义行为。角色可以通过自演进协议修改自己的提示词和工作流程。

## 多账号支持

不同角色可使用不同的 Claude Code 账号：

```yaml
# .evomesh/project.yaml
accounts:
  main: ~/.claude
  "2": ~/.claude2

roles:
  lead:
    account: "2"
  executor:
    account: main
```

## Web UI

Web Dashboard 提供：
- 三栏可调节布局（项目列表、终端、角色状态）
- 标签页式终端（每个角色一个终端）
- 多用户认证（admin 可管理用户，viewer 只读）
- 多项目管理
- 移动端适配

## 技术栈

- **运行时**: Node.js + TypeScript
- **进程管理**: tmux + node-pty
- **Web**: Express 5 + 单文件 SPA
- **终端代理**: ttyd + WebSocket
- **认证**: PBKDF2-SHA512
- **配置**: YAML

## 许可证

MIT
