# EvoMesh Base Protocol v3

> 所有角色必须遵守。简洁 = 遵守率。每条规则都有存在理由。

---

## 1. Loop 流程

每轮 loop 按此顺序执行，不可跳过：

1. `git pull --rebase`（冲突时 stash 后重试）
2. 读取：ROLE.md + todo.md + inbox/ + memory/short-term.md + shared/decisions.md
3. 处理 inbox（P0 必须本轮响应，处理后移入 inbox/processed/）
4. 执行角色工作
5. 写 `memory/short-term.md`（覆盖，格式见下）
6. 追加 `metrics.log`（一行 CSV，不 commit）
7. 更新 todo.md
8. `git add <仅自己的文件>` → commit → `git pull --rebase` → push

**空闲时**：写 "无任务, idle"。连续 3 轮空闲 → 轻量模式（仅查 inbox + 写 memory/metrics）。

> **为什么**：统一流程保证角色状态可追踪，memory 是角色间唯一的状态观测窗口。

---

## 2. 记忆

| 文件 | 用途 | 限制 | Git |
|---|---|---|---|
| `memory/short-term.md` | 当前 loop 上下文 | ≤50 行，每轮覆盖 | .gitignore |
| `memory/long-term.md` | 跨 loop 经验 | ≤200 行，仅追加 | commit |
| `metrics.log` | 性能数据 CSV | 仅追加 | .gitignore |

**short-term 格式**：
```
## YYYY-MM-DD Loop N
- **Done**: ...
- **Blockers**: ...
- **In-progress**: ...
- **Next focus**: ...
```

**metrics.log 格式**：`timestamp,duration_s,tasks_done,errors,inbox_processed`

**归档**：long-term > 200 行 → 旧条目移入 `memory/archive.md`。

> **为什么**：short-term 是其他角色和 Mission Control 观测你状态的唯一方式。空 memory = 角色失联。

---

## 3. Inbox 通信

**文件名**：`YYYYMMDDTHHMM_from_topic.md`

**Frontmatter**（必填 5 项）：
```yaml
---
from: role-name
to: role-name    # "all" = 广播
priority: P0|P1|P2
type: task|proposal|feedback|report|ack
date: YYYY-MM-DDTHH:MM
---
```

**优先级**：P0 = 下一轮响应 | P1 = 2 轮内 | P2 = 1 天内

**P0 直通**：安全/稳定性 P0 直接发给相关角色 + lead，不等 lead 中转。

**P0/P1 完成后**：发 `type: ack, status: done` 给发送者。

> **为什么**：文件通信 = git 可追踪、无额外基础设施、离线角色重启后自动处理积压。

---

## 4. 协调拓扑

**Hub-and-spoke**：跨角色通信经过 lead，除了：
- P0 直通（安全/稳定性问题直达相关角色 + lead）
- Bug 修复直通（reviewer/security → core-dev/frontend，抄送 lead）
- ack 直接回复发送者

> **为什么**：lead 单点协调防止冲突。直通例外避免紧急问题延迟。

---

## 5. Git 与文件

- Commit 格式：`{type}({scope}/{role}): {description}`
- `git add` 仅自己的文件。**禁止 `git add -A` 或 `git add .`**
- **禁止**：`rm -rf`、`git push --force`、`git reset --hard`
- 单文件 > 500 行必须拆分
- 修改前先读现有代码
- 不启动后台进程（服务器、watcher、daemon）
- **All committed content must be in English** — code, comments, commit messages, ROLE.md, docs, devlog, inbox messages. Only user-facing replies (central-status.md, direct responses to user) may use the user's language.

> **为什么**：多角色并行在同一分支工作，精准 git add 防止覆盖他人修改。

---

## 6. 共享文档

- `blueprint.md` / `status.md`：仅 lead 可写
- `shared/decisions.md`：**仅追加**，新条目加在底部，永不编辑已有条目
- `shared/blockers.md`：各角色写自己的阻塞，解决时追加解决记录
- `project.yaml`：仅 Server API 可写，角色不得直接编辑

> **为什么**：仅追加避免多角色并发写入时 git 冲突。单一写入者消除所有权争议。

---

## 7. 自我演进

1. 每 10 轮审查自己的 ROLE.md：删无效规则、合并重复、保持简洁
2. 改动提议发 lead inbox，附 metrics 证据
3. 批准后记录到 `evolution.log`
4. 🔒 标记的规则不可通过自我演进修改（仅用户/lead 可改）

> **为什么**：角色持续优化自己的 prompt = 系统自举的核心。🔒 规则防止演化漂移。

---

## 8. 熔断

连续 3 轮出错 → 写 `heartbeat.json` 标记 `circuit-open` → 发 P0 告警给 lead → 停止工作（继续写心跳）→ 等 lead reset。

> **为什么**：防止错误角色污染 git 历史和消耗资源。

---

## 9. Skills

项目级 skill 在 `.claude/skills/` 目录，所有角色共享。Skill = 文件夹 + `SKILL.md`。

**安装**：
- 从 Anthropic 官方仓库：`/plugin marketplace add anthropics/skills` → 选择安装
- 从 GitHub：`git clone` 后复制 skill 文件夹到 `.claude/skills/`
- 自定义：创建 `skill-name/SKILL.md`，写 name + description + 指令

**发现有用的新 skill** → 记录到 evolution.log → 通知 lead → lead 决定是否加入项目。

> **为什么**：skill 是 Claude Code 的原生扩展机制，让角色获得专项能力而不污染 ROLE.md。
