# EvoMesh Central AI — Architecture Design

## 1. Core Vision

EvoMesh 的核心不是 Web UI，不是容器管理，而是**中枢 AI**（Central AI）。

用户通过中枢 AI 控制一切：创建项目、创建角色、分配任务、监控进度、优化提示词。Web UI 只是中枢 AI 操作的实时可视化。

```
                    用户
                     ↕ 自然语言对话
                ┌─────────────┐
                │  中枢 AI     │
                │  (Central)  │
                │             │
                │  Loop: 5m   │
                │  监控所有项目 │
                │  汇报 + 建议 │
                └──────┬──────┘
                       │ 读写文件 / 发 inbox / 修改配置
          ┌────────────┼────────────┐
          ▼            ▼            ▼
     ┌─────────┐ ┌─────────┐ ┌─────────┐
     │Project A │ │Project B │ │Project C │
     │ lead     │ │ lead     │ │ trader   │
     │ executor │ │ executor │ │ auditor  │
     │ reviewer │ │ designer │ │ risk     │
     └─────────┘ └─────────┘ └─────────┘
```

## 2. 中枢 AI 的本质

中枢 AI **就是一个 Claude Code session**，运行在专属容器里，有以下特权：

### 访问范围
- `~/` — 挂载整个用户 HOME 目录（RW），可访问一切文件
- Docker socket — 管理所有角色容器
- 系统命令 — 可执行任意非危险操作（安装软件、网络请求等）

### 禁止的危险操作
- `rm -rf /` 或 `rm -rf ~`（删除根目录或整个 HOME）
- `git push --force` 到 main/master
- 删除 `.evomesh/` 配置目录
- 修改 `/etc/` 系统配置
- 这些限制写在中枢 AI 的 CLAUDE.md 里，通过 Claude Code 的 `--dangerously-skip-permissions` 的 hook 机制或 CLAUDE.md 硬性规则约束

### 不同于普通角色
| | 普通角色 | 中枢 AI |
|--|---------|---------|
| 作用域 | 单个项目 | 所有项目 |
| 容器挂载 | 单个项目目录 | ~/work/ 全部 |
| 创建角色 | 不可以 | 可以（参考模板文档） |
| 修改提示词 | 只改自己的 | 可改任何角色的 |
| 监控 | 只看自己的 todo | 看所有项目所有角色 |
| 与用户交互 | 通过 inbox | 直接对话 |

## 3. 中枢 AI 的 ROLE.md

```markdown
# Central AI — 信息中枢

> **Loop 周期**: 5m
> **职责**: 监控所有项目进展，向用户汇报，执行用户指令，优化角色效率

## 一、Loop 执行流程

1. 扫描所有项目的角色状态：
   - 读取每个角色的 `todo.md`（待办）
   - 读取每个角色的 `memory/short-term.md`（当前进度）
   - 读取每个角色的 `evolution.log`（最近变更）
   - 检查容器运行状态（`docker ps`）
2. 生成状态摘要，写入 `~/.evomesh/central-status.md`
3. 检查 inbox/（用户通过 Web UI 发的消息）
4. 若有用户指令 → 执行
5. 若发现问题 → 主动汇报 + 建议解决方案
6. 若空闲 → 审查各角色提示词效率，建议优化

## 二、能力清单

### 项目管理
- 创建项目：`mkdir -p ~/work/{name} && cd ~/work/{name} && evomesh init`
- 添加到工作区：编辑 `~/.evomesh/workspace.yaml`
- 删除/归档项目

### 角色管理（不依赖代码模板）
- 创建角色：参考 `~/.evomesh/templates/` 下的模板文档
- 手动创建目录结构 + 编写 ROLE.md
- 可以创建任意类型角色（量化交易员、审计、设计师等）
- 启动/停止角色容器

### 提示词优化
- 读取角色的 ROLE.md 和 evolution.log
- 分析角色产出效率
- 建议或直接修改提示词
- 记录优化理由到角色的 evolution.log

### 状态汇报
- 每个 loop 生成全局状态摘要
- 主动发现异常（角色卡住、任务积压、冲突等）
- 向用户建议下一步行动

## 三、语言规则
- 自动检测用户语言：根据用户第一句话的语言决定后续交互语言
- 用户可随时切换："请用中文" / "Switch to English"
- 创建角色时：角色的 ROLE.md 和相关文档使用项目配置的 lang（project.yaml 的 lang 字段）
- 中枢 AI 自己的日志和状态文件：跟随用户语言
- 模板文档：中英双语都提供（`~/.evomesh/templates/` 下 `*.md` 和 `*-en.md`）

## 四、硬性规则
1. 不得删除用户数据
2. 创建/删除角色需确认
3. 修改提示词需记录原因
4. 所有操作可追溯（写入 central-log.md）
```

## 4. 角色模板：从代码变为文档

当前角色通过 `src/roles/templates/executor.ts` 等代码生成。改为：

```
~/.evomesh/templates/
├── lead.md          # Lead 角色模板文档
├── executor.md      # 执行者模板文档
├── reviewer.md      # 审查者模板文档
└── base-protocol.md # 所有角色共享的基础协议
```

### base-protocol.md（所有角色必须遵守）
包含：
- Loop 执行流程框架
- 自我审查协议
- Git 工作流
- 任务管理格式
- 协作网格协议
- 记忆系统格式

### 角色模板文档（参考用，不是强制的）
包含：
- 角色定位和职责边界
- 该类型角色的典型任务
- 建议的 scope 和 loop 间隔
- 项目特定规则章节（空，由中枢 AI 或角色自行填充）

### 中枢 AI 创建角色的流程
1. 用户说"创建一个量化交易员角色"
2. 中枢 AI 读取 `base-protocol.md`（必须遵守的基础规则）
3. 参考最接近的模板（如 executor.md）
4. **手动编写** 新角色的 ROLE.md（融合基础协议 + 领域特定规则）
5. 创建目录结构：
   ```
   .evomesh/roles/trader/
   ├── ROLE.md        ← 中枢 AI 编写
   ├── todo.md
   ├── archive.md
   ├── evolution.log
   ├── inbox/processed/
   └── memory/
       ├── short-term.md
       └── long-term.md
   ```
6. 更新 `project.yaml` 添加角色配置
7. 启动容器

## 5. 中枢 AI 的容器与配置

中枢 AI 容器挂载整个 `~/` 目录，与宿主机完全一致的文件视图：
```
docker run ...
  -v /home/{user}:/home/{user}:rw     # 整个 HOME
  -v /var/run/docker.sock:/var/run/docker.sock:rw  # Docker 管理
  --user {uid}:{gid}                   # 同宿主机用户
  -w /home/{user}                      # 工作目录 = HOME
```

中枢 AI 的提示词和规则存储在：

```
~/.evomesh/
├── central/
│   ├── ROLE.md           # 中枢 AI 的提示词
│   ├── central-status.md # 全局状态摘要（每个 loop 更新）
│   ├── central-log.md    # 操作日志
│   ├── inbox/            # 用户消息（Web UI 发送到这里）
│   └── memory/
│       ├── short-term.md
│       └── long-term.md
├── templates/            # 角色模板文档
│   ├── base-protocol.md
│   ├── lead.md
│   ├── executor.md
│   └── reviewer.md
├── workspace.yaml        # 项目列表
└── users.yaml            # 用户管理
```

中枢 AI 容器挂载整个 `~/.evomesh/` 目录，所以能读写所有配置。

## 6. Web UI 的变化

### 右侧面板 = 中枢 AI 终端
- 嵌入中枢 AI 的 Claude Code 终端
- 用户直接对话："帮我创建一个量化交易项目"
- 中枢 AI 执行操作，Web UI 实时反映

### 左侧面板 = 项目树（不变）
- 显示所有项目和角色
- 点击打开终端

### Dashboard = 全局总览
- 中枢 AI 生成的状态摘要（读 `central-status.md`）
- 角色管理操作（启动/停止/资源配置）

### 移除的功能
- ~~发消息给 Lead~~（通过中枢 AI 代替）
- ~~SSE 状态流~~（中枢 AI 的 `central-status.md` 代替）
- ~~程序化角色模板~~（中枢 AI 参考文档模板手动创建）

## 7. 中枢 AI 的 Loop 实现

中枢 AI 的容器里，entrypoint 发送的 `/loop` 命令：

```
/loop 5m 你是中枢 AI。执行 ~/.evomesh/central/ROLE.md 工作目录: ~/.evomesh/central/
```

中枢 AI 每 5 分钟：
1. 扫描所有项目状态
2. 更新 `central-status.md`
3. 检查用户消息
4. 执行待办事项
5. 分析效率，建议优化

## 8. 用户交互流程

### 场景 1：创建新项目
```
用户: 帮我创建一个量化交易项目，需要一个交易策略师和一个风控审计师
中枢 AI:
  1. mkdir -p ~/work/quant-trading
  2. cd ~/work/quant-trading && evomesh init
  3. 参考 base-protocol.md + executor.md 模板
  4. 编写 ROLE.md for "strategist"（融入量化交易领域知识）
  5. 编写 ROLE.md for "auditor"（融入风控审计领域知识）
  6. 更新 project.yaml
  7. 启动两个容器
  8. 报告: "项目已创建，2 个角色已启动"
```

### 场景 2：监控进度
```
用户: 所有项目现在什么状态？
中枢 AI:
  1. 读取每个项目每个角色的 short-term.md
  2. 汇总: "EvoMesh: lead 在审查提示词, executor 在重构前端。
            quant-trading: strategist 在回测策略, auditor 空闲。"
```

### 场景 3：优化角色
```
中枢 AI（主动汇报）:
  "发现 EvoMesh/executor 连续 5 个 loop 都在做 UI 修复，
   可能需要在 ROLE.md 里加入'修复前先系统性分析问题根因'的规则。
   是否需要我修改？"
用户: 好，改
中枢 AI: 修改 executor 的 ROLE.md，记录到 evolution.log
```

## 9. 实施步骤

### Phase 1: 模板文档化
1. 把 `src/roles/templates/*.ts` 的内容提取为 `~/.evomesh/templates/*.md`
2. 提取 `base-protocol.md`（所有角色共享的基础协议）
3. 保留代码模板作为 fallback（向后兼容）

### Phase 2: 中枢 AI 容器
1. 创建 `~/.evomesh/central/ROLE.md`
2. 中枢 AI 容器挂载 `~/work/` + `~/.evomesh/` + Docker socket
3. Web UI 右侧面板嵌入中枢 AI 终端
4. entrypoint 发 `/loop 5m` 启动循环

### Phase 3: Dashboard 集成
1. Dashboard 读取 `central-status.md` 显示全局状态
2. 移除程序化角色创建（改为通过中枢 AI）
3. 移除 SSE 状态流（改为中枢 AI 的状态文件）

### Phase 4: 清理
1. 移除 `src/roles/templates/*.ts`（代码模板）
2. 移除 `createRole()` 的模板依赖
3. 简化 routes.ts（很多 API 不再需要，中枢 AI 直接操作文件）

## 10. 不变的部分

- Docker 容器架构（每个角色一个容器）
- ttyd + tmux 终端方案
- 认证系统（密码登录）
- 项目目录结构（.evomesh/roles/）
- 角色的 Loop 协议（ROLE.md → todo.md → inbox）

## 11. 自我攻击

### 攻击 1: 中枢 AI 的 Claude Code 上下文窗口有限
**回应**: 中枢 AI 的状态通过文件持久化（central-status.md, memory/），每个 loop 读文件恢复上下文。不依赖单次 session 的记忆。

### 攻击 2: 中枢 AI 修改角色提示词可能破坏角色
**回应**: 硬性规则要求修改前记录原因到 evolution.log，且角色自己的硬性规则（第三章）不可被修改。

### 攻击 3: 5 分钟 loop 间隔太频繁，浪费 API 调用
**回应**: 可自适应——空闲时 30m，有用户消息或角色异常时 5m。

### 攻击 4: 模板文档化后，新用户不知道怎么开始
**回应**: 中枢 AI 本身就是入口——用户说"帮我开始"，中枢 AI 引导一切。

### 攻击 5: 所有操作都通过中枢 AI，单点故障
**回应**: Web UI 仍然保留基本操作（启动/停止容器、查看 Dashboard），中枢 AI 挂了不影响已运行的角色。
