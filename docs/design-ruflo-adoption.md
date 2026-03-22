# Design Document: Adopting RuFlo Features into EvoMesh

> Reference: [ruvnet/ruflo](https://github.com/ruvnet/ruflo) — Enterprise multi-agent AI orchestration platform

## Executive Summary

RuFlo has 5900+ commits and 60+ agent types, but大部分复杂度（WASM 向量引擎、Raft 共识、IPFS 模式共享）不适合 EvoMesh 的简洁定位。本文筛选出 **3 个高价值特性**进行适配，保持 EvoMesh 的文件驱动、git 原生特色。

## 采纳决策

| 优先级 | 特性 | 采纳 | 工期 | 理由 |
|--------|------|------|------|------|
| 1 | Task Claims 系统 | **YES** | 1 周 | 解决任务追踪盲区，最高 ROI |
| 2 | Model/Tier 路由 | **YES** | 3 天 | 省 30% token 成本 |
| 3 | 负载感知调度 | **YES** | 2 天 | 基于 Claims 的自然延伸 |
| 4 | 自动记忆循环 | **NO** | - | 2-7 角色规模下手动管理足够 |
| 5 | 事件溯源 | **NO** | - | git 本身就是事件存储 |

---

## Feature 1: Task Claims 系统

### 问题

当前 lead 分发 inbox 消息后，无法追踪：
- 角色是否已接手？
- 进度如何？
- 是否遇到阻塞？
- 是否完成？

Lead 必须逐个读 `short-term.md` 交叉对比，效率低且容易漏掉。

### RuFlo 做法

完整 DDD: repositories + event store + claim/release/handoff/steal + 8 种状态。750+ 行 ClaimService。

### EvoMesh 适配

**一个 JSON 文件** `.evomesh/shared/claims.json`，git 原生，所有角色可读写。

#### 文件格式

```json
{
  "claims": [
    {
      "id": "20260322T1400-lead-auth-refactor",
      "task": "Refactor auth module to support OAuth2",
      "priority": "P1",
      "assignedBy": "lead",
      "assignedTo": "core-dev",
      "status": "in-progress",
      "claimedAt": "2026-03-22T14:00:00Z",
      "lastActivityAt": "2026-03-22T15:30:00Z",
      "notes": ["Started analyzing auth.ts", "Found 3 breaking changes"],
      "blockedReason": null,
      "inboxRef": "20260322T1400_lead_auth-refactor.md"
    }
  ]
}
```

#### 状态机（5 种，简化自 RuFlo 的 8 种）

```
unclaimed → in-progress → in-review → completed
                ↓
            blocked → in-progress (unblocked)
```

#### 集成点

| 组件 | 变更 |
|------|------|
| `CLAUDE.md.tmpl` | Loop step 3.5: 处理 inbox 后，更新 claims.json 中自己的 claim 状态 |
| `lead.md.tmpl` | Step 6: 读 claims.json 替代逐个读 short-term.md 检测 idle |
| `routes.ts` | 新增 `GET /api/projects/:slug/claims` |
| `frontend-dashboard.js` | Claims Board 面板（看板视图：unclaimed / in-progress / blocked / done） |
| `routes-feed.ts` | pollRoleUpdates 检查 claims.json mtime，广播状态变更 |

#### 不采纳的 RuFlo Claims 特性

- Handoff chains（EvoMesh 通过 lead inbox 重新分发，更简单）
- Work stealing（2-7 角色规模不需要）
- Contest mechanism（lead 直接仲裁）
- Event store（git history 就是）
- Repository/DDD 结构（单文件足够）

---

## Feature 2: Model/Tier 路由

### 问题

所有角色使用同一个模型。Lead 做战略决策需要 Opus 推理能力，但 core-dev 写代码用 Sonnet 就够了。Haiku 做简单任务（todo 更新、文件移动）浪费更少。

### RuFlo 做法

AST 复杂度分析 + WASM 代码变换引擎 + 神经路由器。每个任务动态选择模型。

### EvoMesh 适配

**配置驱动**：在 `project.yaml` 的角色配置中加 `model` 字段。

#### Schema 变更

```typescript
// src/config/schema.ts
export interface RoleConfig {
  // ... existing ...
  model?: "opus" | "sonnet" | "haiku";  // default: "sonnet"
}
```

#### 默认模型映射

| 角色类型 | 默认模型 | 理由 |
|---------|---------|------|
| lead | opus | 战略决策、跨角色协调 |
| reviewer, security | opus | 判断密集型 |
| core-dev, frontend | sonnet | 实现型任务 |
| research | sonnet | 信息收集（复杂分析时临时切 opus） |

#### 集成点

| 组件 | 变更 |
|------|------|
| `container.ts` | startRole() 传 `--model ${rc.model}` 或设置 env var |
| `routes-roles.ts` | config 更新处理器接受 `model` 字段（不触发重启） |
| `routes.ts` | status 响应包含 `model` 字段 |
| `frontend-dashboard.js` | 角色表格加模型选择器下拉 |
| `project.yaml.tmpl` | 默认角色配置包含 model |

#### 不采纳的 RuFlo 路由特性

- Per-task 动态路由（需要拦截 Claude Code 内部 API，侵入性太强）
- AST 复杂度分析（需要 agentic-flow 依赖）
- WASM 引擎
- 神经路由器

**简化理由**：EvoMesh 角色已按功能特化。角色类型是任务复杂度的足够代理，不需要 per-task 分析。

---

## Feature 3: 负载感知调度

### 问题

Lead 目前通过读 short-term.md 判断角色是否空闲——没有结构化的负载视图。

### 前置依赖

Feature 1（Claims 系统）。

### EvoMesh 适配

**新 API**：`GET /api/projects/:slug/load`

```json
{
  "roles": [
    {
      "name": "core-dev",
      "running": true,
      "activeClaims": 3,
      "blockedClaims": 1,
      "idleLoops": 0
    },
    {
      "name": "frontend",
      "running": true,
      "activeClaims": 0,
      "blockedClaims": 0,
      "idleLoops": 5
    }
  ]
}
```

#### 集成点

| 组件 | 变更 |
|------|------|
| `routes.ts` 或新 `routes-claims.ts` | 读 claims.json + health 数据，计算 per-role 负载 |
| `lead.md.tmpl` | "读 claims.json，0 active claims + running = idle → 立即分发" |
| `frontend-dashboard.js` | 角色表格加 Load 列（badge: 0=灰, 1-2=绿, 3+=黄, blocked=红） |
| `CLAUDE.md.tmpl` | 新规则："running 角色 0 claims 超过 2 loops，lead 必须分发" |

#### 不采纳的 RuFlo 负载均衡特性

- 自动 rebalance（lead 手动处理，2-7 角色不需要自动化）
- 利用率比率/历史平均（过度工程）
- Swarm 级编排

---

## 不采纳的特性

### 自动记忆循环 — 拒绝

**RuFlo 需要它**：60+ agent，手动记忆管理不可能。

**EvoMesh 不需要**：
- 2-7 角色，每个 loop 手动写 30 行 short-term.md 完全可控
- 自演进协议 + self-audit 已覆盖记忆质量
- Claims 系统提供了结构化活动追踪，减少了 short-term.md 解析的必要性
- 引入嵌入模型/PageRank 计算违反"无重依赖"约束

### 事件溯源 — 拒绝

**RuFlo 需要它**：60+ agent 的内存协调需要完整审计轨迹。

**EvoMesh 不需要**：
- Git 就是 EvoMesh 的事件存储
- `git log --follow .evomesh/shared/claims.json` = claim 变更历史
- `git log --follow .evomesh/roles/core-dev/inbox/` = 任务分发历史
- 独立事件存储会创建双源真相问题

---

## 实施计划

### Phase 1: Claims 系统（第 1 周）

| 天 | 任务 |
|----|------|
| 1-2 | 核心：claims.json 格式规范、`routes-claims.ts` API、claim 读取逻辑 |
| 3-4 | 规则集成：更新 CLAUDE.md.tmpl、lead.md.tmpl、core-dev.md.tmpl、当前项目规则 |
| 5 | Dashboard Claims Board UI + Feed 集成 + 端到端测试 |

### Phase 2: Model 路由（第 2 周前 3 天）

| 天 | 任务 |
|----|------|
| 1 | Schema: model 字段 + container.ts 传递 model flag |
| 2 | API + UI: config handler、status response、dashboard 下拉 |
| 3 | 测试 + 模板更新 |

### Phase 3: 负载感知（第 2 周后 2 天）

| 天 | 任务 |
|----|------|
| 4 | Load API + Dashboard 负载 badge |
| 5 | Lead 规则更新 + 场景测试 |

---

## 关键设计决策

1. **Claims 在 git 中，不是数据库**：`claims.json` 随真实工作一起 commit。所有角色无需 API 即可读取。Git 历史提供完整审计轨迹。合并冲突风险低（每个角色只更新自己的 claim）。

2. **Model 作为静态配置，不是动态路由**：按角色级别分配模型，不按任务。避免拦截 Claude Code 内部。Lead 始终 Opus，Executor 始终 Sonnet。临时需要不同模型时 lead 通过 API 改配置。

3. **不做 handoff/steal**：EvoMesh 的 lead 是唯一协调者。任务需要转移时，lead 创建新 inbox 消息。Claims 让阻塞可见，lead 可及时行动。

4. **claims.json 范围**：每个项目一个（在 `.evomesh/shared/`），不是每个角色。Lead 一个文件看到所有工作。

---

## 参考文件

| RuFlo | 用途 |
|-------|------|
| `v3/@claude-flow/claims/src/application/claim-service.ts` | Claims 生命周期逻辑 |
| `v3/@claude-flow/claims/src/application/load-balancer.ts` | 负载均衡算法 |
| `v3/implementation/adrs/ADR-016-collaborative-issue-claims.md` | Claims 设计决策 |
| `v3/implementation/adrs/ADR-026-three-tier-model-routing.md` | 模型路由设计 |

| EvoMesh | 需要修改 |
|---------|---------|
| `src/config/schema.ts` | 加 `model` 字段 |
| `src/process/container.ts` | startRole() 传 model |
| `src/server/routes-roles.ts` | config handler 加 model |
| `defaults/templates/project-scaffold/CLAUDE.md.tmpl` | Claims lifecycle 指令 |
| `defaults/templates/roles/lead.md.tmpl` | Claims-based dispatch |
