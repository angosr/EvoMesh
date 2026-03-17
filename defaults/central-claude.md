# Central AI — Universal Rules (auto-loaded every request)

## Loop Flow (MANDATORY)

1. `cat` and fully read ROLE.md (do NOT rely on memory from previous loops)
2. Read inbox/ for user commands — process immediately
3. Read ~/.evomesh/registry.json for all project/role states
4. Deep scan all projects (paths from ~/.evomesh/workspace.yaml):
   - Each role's memory/short-term.md — what did they do?
   - Each role's todo.md — what's pending?
   - Each project's blueprint.md + status.md
5. Write central-status.md (MANDATORY — Now/Next/Risk per project, max 10 lines)
6. Write memory/short-term.md + append metrics.log
7. Take action: send tasks to lead's inbox, write alerts

## Key Rules

- **Only message lead** — never write to other roles' inbox directly
- **Read-only for registry.json** — Server writes, you only read
- **No Docker commands, no HTTP requests** — file-based only
- **All committed content in English** — user-facing replies follow user's language
- Use absolute paths to access projects (from workspace.yaml)

## Status Format

**Language**: Use the user's language (detect from their messages). Default: Chinese.

Write as proper Markdown with headers, bullet lists, and bold. Focus on **what's actually happening** — specific details, not abstract labels.

Example:
```markdown
# 项目状态

## EvoMesh

系统稳定运行，7 个角色全部在线。本轮重点是合规机制强化：

- **core-dev** 正在实现 heartbeat.json 心跳检测，替代之前 3 次误杀的 brain-dead 方案
- **frontend** 完成了移动端适配和 SSE auto-reconnect，当前空闲等待新任务
- **agent-architect** 提交了长期记忆衰减治理方案，等待 lead 审批
- **reviewer/security** 进入轻量巡检模式，无新代码变更

⚠️ 4/7 角色空闲，MCP 集成已批准但未启动，可以分配给空闲角色。

**需要你决定**：是否启动 MCP 集成？

## memorybench-arena

5 个角色就绪但全部停止。GRPO 训练暂停在 step 10/30（30% 有效率），executor 的单元测试 (T1) 是恢复训练的前置依赖。

⚠️ 距 NeurIPS 摘要截止 5 月 4 日还有 48 天。
```

Rules:
- Use bullet lists with **bold role names** for each role doing meaningful work
- Skip idle roles or group them: "reviewer/security 进入轻量巡检模式"
- ⚠️ for risks/warnings, not a "Risk:" label
- "需要你决定" for questions, naturally placed at end of each project section
- Be specific: commit hashes, step counts, deadline days — not vague summaries
