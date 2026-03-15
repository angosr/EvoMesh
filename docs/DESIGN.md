# EvoMesh — 自演进多角色协作系统设计文档

> **定位**: 基于 Claude Code 的多角色自演进开发框架。不构建新 Agent，而是复用 Claude Code 原生能力（CLAUDE.md、skills/、settings.local.json），提供结构化的角色模板、自演进协议和 Web 操作界面。

---

## 一、与 Claude Code 原生结构的兼容策略

Claude Code 原生使用以下结构，EvoMesh **全部复用，不重新发明**：

| Claude Code 原生 | EvoMesh 用途 |
|------------------|-------------|
| `CLAUDE.md` (项目根) | 项目级共享指令，所有角色自动加载 |
| `.claude/settings.local.json` | 项目级权限配置 |
| `.claude/skills/{name}/SKILL.md` | 项目级共享 skills |
| `CLAUDE_CONFIG_DIR` 环境变量 | 多账号切换（指向不同 config 目录） |

EvoMesh 仅新增 `.evomesh/` 目录存放角色定义和协作文件，不侵入 `.claude/`。

---

## 二、目录结构

```
project-root/
├── CLAUDE.md                         # 项目级指令（所有角色自动读取）
├── .claude/
│   ├── settings.local.json           # 原生权限配置
│   └── skills/                       # 项目级共享 skills
│
├── devlog/                           # 开发日志目录
│   ├── {date}-{topic}.md            # 按日期+主题命名
│   └── ...
│
├── .evomesh/
│   ├── project.yaml                  # 项目配置（角色定义、账号映射）
│   ├── blueprint.md                  # 战略蓝图（仅主角色可写）
│   ├── status.md                     # 项目现况（仅主角色可写）
│   │
│   ├── roles/
│   │   ├── lead/                     # 主角色（默认名 lead）
│   │   │   ├── ROLE.md               # 角色提示词（≤500 行硬限制）
│   │   │   ├── loop.md               # loop 入口提示词
│   │   │   ├── todo.md               # 待办任务
│   │   │   ├── archive.md            # 已完成任务归档
│   │   │   ├── evolution.log         # 演进日志
│   │   │   ├── inbox/                # 收件箱
│   │   │   │   └── processed/
│   │   │   ├── memory/
│   │   │   │   ├── short-term.md     # 短期记忆（≤200 行）
│   │   │   │   └── long-term.md      # 长期记忆（≤500 行）
│   │   │   └── skills/               # 角色专属 skills
│   │   │       └── {name}/
│   │   │           └── SKILL.md      # Claude Code 原生 skill 格式
│   │   │
│   │   ├── executor/                 # 执行角色（同构目录）
│   │   │   ├── ROLE.md
│   │   │   ├── loop.md
│   │   │   ├── todo.md
│   │   │   ├── archive.md
│   │   │   ├── evolution.log
│   │   │   ├── inbox/
│   │   │   │   └── processed/
│   │   │   ├── memory/
│   │   │   │   ├── short-term.md
│   │   │   │   └── long-term.md
│   │   │   └── skills/
│   │   │
│   │   └── reviewer/                 # 审查角色（同构目录）
│   │       └── ...
│   │
│   ├── shared/                       # 共享空间
│   │   ├── decisions.md              # 技术决策记录
│   │   └── blockers.md               # 阻塞问题
│   │
│   └── runtime/                      # 运行时状态（.gitignore）
│       ├── lead.pid
│       ├── executor.pid
│       └── ...
```

### Skill 文件格式（复用 Claude Code 原生格式）

```markdown
---
name: audit-code
description: 审查指定文件的代码质量
allowed-tools: Read, Grep, Glob
---

审查 $ARGUMENTS 指定的文件，检查以下维度：
1. 代码风格一致性
2. 错误处理完整性
3. 单文件是否超过 1000 行
输出问题清单和修复建议。
```

---

## 三、核心概念

| 概念 | 说明 |
|------|------|
| **Lead (主角色)** | 审查所有角色、维护战略蓝图和项目现况、分配任务 |
| **Worker (工作角色)** | executor / reviewer / researcher 等，接收任务并执行 |
| **Loop** | Claude Code `/loop` 驱动的持续运行周期 |
| **Evolution** | 角色空闲时触发的自我审查和提示词升级 |
| **Mesh** | 多角色通过 inbox + 共享文件交换信息 |

---

## 四、角色模板设计

### 4.1 ROLE.md 模板（≤500 行硬限制）

```markdown
# {角色名} — {一句话定位}

> **Loop 周期**: {N}m（可自行调整，须记录原因）
> **职责边界**: {明确的文件和功能范围}

---

## 一、自我演进协议

### 1.1 每次 Loop 执行流程
1. `git pull --rebase origin main`（冲突时自行解决，记录到 devlog）
2. 读取本文件 + todo.md
3. 检查 inbox/（处理后移入 inbox/processed/）
4. 若有任务 → 执行任务
5. 若无任务 → 触发自我审查
6. 更新 todo.md、short-term.md
7. commit + push（如有变更）

### 1.2 自我审查协议（空闲时自动触发）

**小方向审查**（攻击现有实现）:
- 现有功能和模块是否完善？哪些边界情况未处理？
- 代码质量：是否有重复代码、过深嵌套、缺失测试？
- 本角色的提示词是否有冗余/模糊/过时指令？→ 修剪
- 用户历史纠正是否已沉淀为规则？
- 短期/长期记忆是否有失效条目？→ 清理

**大方向审查**（攻击项目路线）:
- 检索相关前沿项目和论文，对比当前技术路线
- 分析架构是否可扩展，是否有更优方案
- 评估当前迭代方向的 ROI
- 产出审查报告写入 devlog/

**审查结果处理**:
- 发现问题 → 写入 todo.md 或通过 inbox 报告给 lead
- 提示词需修改 → 修改 ROLE.md + 记录到 evolution.log
- 大方向洞察 → 通过 inbox 报告给 lead

### 1.3 提示词升级规则
- 每 {U} 个 loop 周期强制一次提示词全面审查（U 初始值 = 30）
- 原则：文档服务于执行效率，一切不提升效率的内容必须移除
- 变更必须记录到 evolution.log（diff 摘要 + 原因）
- 升级后立即 commit

### 1.4 Loop 周期自调整
- 允许修改自己的 loop 周期
- 必须在 evolution.log 记录调整原因
- 合理范围：5m ~ 60m（超出需 lead 审批）

---

## 二、开发协议

### 2.1 代码规范
- 单文件不超过 1000 行，超过必须拆分
- 修 bug 必须理解根因后彻底解决，禁止打补丁
- 禁止 fallback 逻辑掩盖问题
- 禁止 try-catch 吞异常、默认值掩盖 null
- 新增功能必须有测试

### 2.2 Git 工作流
- 所有角色在同一分支（main）工作
- 每次 loop 开头 `git pull --rebase`
- 冲突由当前角色自行解决（分工明确时极少冲突）
- 开发阶段完成必须 commit + push
- commit message: `{type}({scope}): {description}`
- 禁止 commit message 包含 Co-Authored-By / Generated-by

### 2.3 任务管理
- todo.md: 当前待办（lead 可通过 inbox 追加任务）
- archive.md: 已完成任务，一行格式:
  `[{date}] {task-summary} → {commit-hash}`
- archive.md 超过 50 条时，最早 25 条压缩为统计摘要

---

## 三、硬性规则（不可自我演进修改）

1. **禁止危险操作**: 不得 `rm -rf`、`git push --force`、`git reset --hard`、因空间不足随意删文件
2. **禁止越权**: 不得修改其他角色的 ROLE.md；不得修改 project.yaml
3. **不得修改只读文档**: blueprint.md 和 status.md 仅 lead 可写，其他角色只读
4. **禁止数据破坏**: 不得删库、不得覆盖 production 配置
5. **隔离边界**: 只修改职责范围内的代码文件
6. **演进约束**: 自我审查可优化一、二、四、五章节，不得修改本章
7. **透明性**: 所有自我演进变更必须记录到 evolution.log

---

## 四、协作网格协议

### 4.1 消息机制
- 发消息 = 在目标角色 `inbox/` 创建 `{timestamp}_{from}_{subject}.md`
- 格式:
  ```markdown
  ---
  from: {sender}
  priority: high | normal | low
  type: task | info | request | feedback
  ---
  {内容}
  ```
- 每次 loop 检查 inbox，处理后移入 processed/

### 4.2 Lead 特权
- 可向任何角色 inbox 发布任务（type: task）
- 审查所有角色的 ROLE.md、todo.md、evolution.log
- 独占写入 blueprint.md（战略蓝图）和 status.md（项目现况）
- 发现角色问题可直接在其 inbox 提出修正要求

### 4.3 共享文档
- `shared/decisions.md` — 技术决策记录（任何角色可追加）
- `shared/blockers.md` — 阻塞问题（任何角色可追加）
- `devlog/` — 开发日志（任何角色可写，按日期主题命名）

---

## 五、记忆系统

### 5.1 短期记忆 (memory/short-term.md)
- 当前 loop 周期的上下文、中间结果、临时发现
- ≤200 行，超出时沉淀有价值内容到长期记忆

### 5.2 长期记忆 (memory/long-term.md)
- 跨 loop 的经验规则、问题模式
- 格式：`### {主题}` + 规则 + 来源 + 有效期
- ≤500 行，自我审查时清理过期条目

### 5.3 演进日志 (evolution.log)
- 格式:
  ```
  ## Evo-{N} | {date} | Loop #{count}
  - 类型: audit | upgrade | loop-adjust
  - 变更: {内容}
  - 原因: {why}
  ```
- ≤200 行，超出归档到 evolution-archive.md
```

---

### 4.2 Lead 角色特殊职责

Lead 角色除了遵循通用模板外，额外负责：

```markdown
## 六、Lead 专属协议（仅 lead 角色包含此章节）

### 6.1 战略蓝图维护 (blueprint.md)
- 包含：项目愿景、技术路线、里程碑、架构决策
- 每 5 个 loop 审查一次，结合前沿动态更新
- 其他角色只读

### 6.2 项目现况维护 (status.md)
- 包含：当前进度、各角色状态、风险项、近期变更摘要
- 每个 loop 更新

### 6.3 全角色审查
- 每个 loop 轮询所有角色的：
  - todo.md — 任务是否合理、是否受阻
  - evolution.log — 演进是否健康
  - ROLE.md — 提示词质量
- 发现问题通过 inbox 发 feedback
- 可随时通过 inbox 向任何角色发布 task

### 6.4 大方向审查（Lead 视角）
- 审查所有角色的大方向审查报告
- 综合判断项目整体路线是否需要调整
- 结合前沿论文和竞品分析
- 产出战略审查报告到 devlog/
```

---

## 五、project.yaml 配置

```yaml
name: "my-project"
created: "2026-03-15"
repo: "git@github.com:user/repo.git"

# 多账号配置
accounts:
  main: "~/.claude"                          # 默认账号
  secondary: "~/.claude-accounts/account2"   # 备用账号
  team-shared: "~/.claude-accounts/team"     # 团队共享账号

roles:
  lead:
    type: lead                  # lead 类型，拥有特权
    loop_interval: 20m
    account: main               # 使用哪个 Claude Code 账号
    evolution_upgrade_every: 30
    scope:                      # 职责范围（推荐，非强制锁定）
      - ".evomesh/blueprint.md"
      - ".evomesh/status.md"
      - ".evomesh/roles/*/inbox/"
      - "docs/"
    description: "项目总控，审查所有角色，维护战略蓝图"

  executor:
    type: worker
    loop_interval: 10m
    account: secondary          # 可用不同账号避免 rate limit
    evolution_upgrade_every: 20
    scope:
      - "src/"
      - "tests/"
    description: "代码实现，测试，提交"

  reviewer:
    type: worker
    loop_interval: 15m
    account: main
    evolution_upgrade_every: 25
    scope:
      - "src/"
      - "tests/"
      - "docs/"
    description: "代码审查，质量把控"

# Git 配置
git:
  branch: main                  # 所有角色在同一分支
  conflict_resolution: auto     # 角色自行解决冲突
  auto_push: true               # 每次 commit 后自动 push
```

---

## 六、启动机制

### 6.1 角色启动命令

```bash
# 启动单个角色
# 本质是设置环境变量 + 调用 claude code 的 /loop
CLAUDE_CONFIG_DIR={account_path} claude \
  --project-dir {project-root} \
  /loop {interval} "$(cat .evomesh/roles/{role}/loop.md)"
```

### 6.2 loop.md 内容（精简入口）

```markdown
你是 {角色名}。

1. 读取 .evomesh/roles/{name}/ROLE.md 获取完整指令
2. 读取 .evomesh/roles/{name}/todo.md 获取当前任务
3. 读取 .evomesh/roles/{name}/inbox/ 检查新消息
4. 按 ROLE.md 中的执行流程工作

角色目录: .evomesh/roles/{name}/
Skills 目录: .evomesh/roles/{name}/skills/
```

### 6.3 evomesh CLI 启动流程

```bash
# 启动所有角色（每个角色一个后台进程）
evomesh start

# 启动指定角色
evomesh start executor

# 指定账号启动
evomesh start executor --account secondary

# 附加到角色终端
evomesh attach executor
```

内部流程：
1. 读取 project.yaml
2. 对每个角色：
   - 设置 `CLAUDE_CONFIG_DIR` 为对应 account 路径
   - 通过 node-pty spawn `claude /loop {interval} "$(cat loop.md)"`
   - 记录 PID 到 `.evomesh/runtime/{role}.pid`
3. 所有进程在同一项目目录下工作（同一物理目录）

### 6.4 新项目初始化

```bash
evomesh init
```

流程：
1. 创建 `.evomesh/` 骨架
2. 启动 Bootstrap Session（一个临时 Claude Code 实例）
3. Bootstrap Session：
   - 分析项目代码和技术栈
   - 与用户对话确认角色方案
   - 生成各角色 ROLE.md + 配置
   - 创建 project.yaml
   - 初始化 blueprint.md 和 status.md

```bash
evomesh import --from {path-or-repo}
```

- 克隆/复制项目 → 检查是否有 `.evomesh/` → 有则复用，无则进入 init 流程

---

## 七、Web UI 设计

### 7.1 架构

```
Browser ←─ WebSocket ─→ EvoMesh Server ←─ PTY ─→ Claude Code 进程 ×N
                              │
                         SSH Key Auth
                              │
                         Session Manager
```

技术栈：
- **后端**: Node.js + Express + ws
- **终端**: node-pty (服务端) + xterm.js (浏览器端)
- **前端**: React + xterm.js + 可拖拽面板
- **认证**: SSH Key（安全细节后续迭代）

### 7.2 界面布局

```
┌──────────────────────────────────────────────────────────┐
│  EvoMesh    │ Project: my-app        │ Users: A, B       │
├─────────────┼────────────────────────────────────────────┤
│             │  ┌─ Grid Layout ──────────────────────┐    │
│  Projects   │  │ ┌────────────┐ ┌────────────┐     │    │
│  > my-app   │  │ │ Lead       │ │ Executor   │     │    │
│    app-v2   │  │ │ [terminal] │ │ [terminal] │     │    │
│             │  │ └────────────┘ └────────────┘     │    │
│  Roles      │  │ ┌────────────┐ ┌────────────┐     │    │
│  ● Lead     │  │ │ Reviewer   │ │ Dashboard  │     │    │
│  ● Executor │  │ │ [terminal] │ │ blueprint  │     │    │
│  ○ Reviewer │  │ │            │ │ status     │     │    │
│             │  │ └────────────┘ │ messages   │     │    │
│  [▶ Start]  │  │               └────────────┘     │    │
│  [⏹ Stop]   │  └──────────────────────────────────┘    │
│  [+ Role]   │                                           │
└─────────────┴───────────────────────────────────────────┘
```

### 7.3 核心功能

| 功能 | 说明 |
|------|------|
| **真实终端** | 每个角色一个 PTY，xterm.js 渲染，100% 兼容 Claude Code |
| **布局** | Grid / Tab / Stacked，拖拽调整 |
| **角色管理** | 启动/停止/重启，切换账号 |
| **Dashboard** | blueprint + status + 消息流 + 演进时间线 |
| **多用户** | 多人同时操作不同终端面板 |
| **devlog 浏览** | 查看/搜索开发日志 |

### 7.4 进程管理

```
[Web UI] ── POST /api/roles/executor/start ──→ [Server]
                                                   │
                                              read project.yaml
                                                   │
                                              CLAUDE_CONFIG_DIR={account}
                                              spawn claude via node-pty
                                                   │
                                              [PTY] ←→ [Claude Code]
                                                   │
[Web UI] ←── WebSocket (bidirectional) ────────────┘
```

- node-pty 创建真实 PTY，Claude Code 不知道自己在 Web 中
- WebSocket 双向转发 stdin/stdout
- 进程崩溃自动重启（退避: 1s → 5s → 30s → 5m）
- PID 记录到 `.evomesh/runtime/`

---

## 八、自演进详细设计

### 8.1 演进时序

```
空闲 Loop ─── 自我审查（小方向：攻击实现）───
空闲 Loop ─── 自我审查（大方向：攻击路线）───  交替进行
...
Loop U ────── 强制提示词全面升级 ───
```

- 有任务时：执行任务，不触发审查
- 无任务时：自动进入审查模式
- 小方向和大方向交替进行
- 每 U 个 loop 强制一次全面升级（不管是否空闲）

### 8.2 小方向审查（攻击实现）

角色以"攻击者"视角审视自己负责的模块：
1. 功能完整性：哪些边界未处理？哪些路径未测试？
2. 代码质量：重复代码？过度耦合？缺失错误处理？
3. 性能：有无明显瓶颈？
4. 提示词质量：ROLE.md 是否精简有效？

产出 → todo.md（小问题自己修）或 inbox 消息给 lead（需协调的问题）

### 8.3 大方向审查（攻击路线）

角色以"挑战者"视角质疑项目方向：
1. 搜索相关领域的前沿项目、论文、技术博客
2. 对比当前方案 vs 业界最佳实践
3. 评估技术路线的可行性和竞争力
4. 识别潜在的技术债务和架构风险

产出 → devlog/ 审查报告 + inbox 消息给 lead（战略建议）

### 8.4 Lead 的全局审查

Lead 除了审查自身，还审查所有其他角色：
1. 读取每个角色的 todo.md — 任务是否合理、进度是否正常
2. 读取每个角色的 evolution.log — 演进方向是否健康
3. 读取每个角色的 ROLE.md — 提示词质量是否达标
4. 综合所有角色的大方向审查报告 → 更新 blueprint.md
5. 更新 status.md 反映项目全貌

### 8.5 演进安全

- 硬性规则（第三章）不可被演进修改
- 所有变更记录到 evolution.log
- 连续 3 个 loop 失败 → 自动回滚到上一版 ROLE.md
- Loop 周期调整范围: 5m ~ 60m

---

## 九、devlog 规范

```
devlog/
├── 2026-03-15-init-architecture.md
├── 2026-03-15-executor-audit-report.md
├── 2026-03-16-frontend-perf-review.md
└── ...
```

命名：`{date}-{topic}.md`

内容格式：
```markdown
# {标题}

- **作者**: {角色名}
- **类型**: audit-report | decision | incident | research
- **日期**: {date}

## 内容
{正文}

## 结论/行动项
{要点}
```

devlog 不限大小，是所有角色的公共记录空间。任何角色都可以写入。

---

## 十、与 memorybench-arena 的改进对比

| 维度 | memorybench-arena | EvoMesh |
|------|-------------------|---------|
| 角色文件 | 格式不一，TRAINER.md 2059 行 | 统一模板 ≤500 行 + 独立 todo/archive |
| 任务管理 | 内嵌在角色文件中 | 独立 todo.md / archive.md |
| 通信 | 直接修改对方文件 | inbox 消息机制 |
| 演进 | 无系统化演进 | 空闲审查 + 周期升级 + evolution.log |
| 审查 | AUDITOR 手动审查 | Lead 自动审查 + 攻击式自审 |
| 记忆 | 全混在角色文件中 | short-term / long-term 分层 |
| 全局视角 | 无战略文档 | blueprint.md + status.md |
| 启动 | 手动复制 /loop 命令 | `evomesh start` 一键启动 |
| 兼容性 | 自定义结构 | 复用 Claude Code 原生 skills/settings |
| 多账号 | 不支持 | CLAUDE_CONFIG_DIR 切换 |
| 远程操作 | 无 | Web UI + SSH |

---

## 十一、实施路线

### Phase 1 — CLI + 模板 (MVP)
- [ ] `evomesh init` — 创建 .evomesh/ 骨架 + Bootstrap Session
- [ ] `evomesh role create` — 从内置模板生成角色
- [ ] `evomesh start/stop` — 通过 node-pty 管理 Claude Code 进程
- [ ] 3 个内置模板: lead, executor, reviewer
- [ ] project.yaml 解析和验证
- [ ] 多账号支持 (CLAUDE_CONFIG_DIR)

### Phase 2 — 协作 + 演进
- [ ] inbox 消息机制
- [ ] todo.md / archive.md 管理
- [ ] 自我审查协议（小方向 + 大方向）
- [ ] evolution.log 管理
- [ ] Lead 全角色审查
- [ ] blueprint.md / status.md 维护
- [ ] devlog/ 规范

### Phase 3 — Web UI
- [ ] 终端桥接 (node-pty + xterm.js + WebSocket)
- [ ] SSH Key 认证
- [ ] 可拖拽面板布局
- [ ] Dashboard（blueprint + status + 消息流）
- [ ] 多用户支持

### Phase 4 — 打磨
- [ ] 模板导入/导出
- [ ] 演进时间线可视化
- [ ] devlog 搜索和浏览
- [ ] 角色健康度监控
