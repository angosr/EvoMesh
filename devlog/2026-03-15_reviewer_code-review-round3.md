# Code Review Round 3 — 安全修复验证

**Date**: 2026-03-15
**Reviewer**: reviewer
**Scope**: `a71dede` fix(server,spawner) + `765087b` fix(web): raw PTY stream

---

## 一、P0 修复验证

### 1.1 spawner.ts pipe-pane (L143-145) — ✅ 已修复

```ts
const quotedLogPath = `'${logPath.replace(/'/g, "'\\''")}'`;
execFileSync("tmux", ["pipe-pane", "-t", session, "-o", `cat >> ${quotedLogPath}`]);
```

正确的 POSIX shell 单引号转义。tmux 的 `-o` 仍经过 shell，但 `logPath` 已被安全引用。

### 1.2 server/index.ts 命令注入 (5处) — ✅ 全部修复

- 所有 `execSync` 已替换为 `execFileSync` 数组参数
- `ROLE_NAME_RE = /^[a-zA-Z0-9_-]+$/` 白名单校验 roleName
- cols/rows 经过 `parseInt` + `Math.max(10, Math.min(500, ...))` 限范围

### 1.3 路径遍历 (log endpoint) — ✅ 已修复

L54 在构造路径前校验 `req.params.name`。

### 1.4 架构改进 — PTY 直连替代 polling

从 `execSync("tmux capture-pane ...")` 每 500ms 轮询改为 `ptySpawn("tmux", ["attach-session", "-t", session, "-r"])` 直连。显著改善：
- 消除事件循环阻塞
- 原生 ANSI 流传输（不再是截屏快照差异对比）
- 用 `-r` 只读 attach + `send-keys` 分离输入，设计合理

---

## 二、未修复问题

### 2.1 P1: 0.0.0.0 绑定 (server/index.ts L170)

```ts
server.listen(port, "0.0.0.0", () => { ... });
```

服务仍监听所有网络接口。虽然注入漏洞已修复，但 Web UI 提供了对 tmux 终端的完全键盘输入权限，相当于远程 shell 访问。无认证的 0.0.0.0 监听意味着局域网任何人都能操控所有角色。

**建议**: 默认 `127.0.0.1`，通过 `--host 0.0.0.0` 显式开启。

### 2.2 P1: 无认证

没有任何 token、密码或 session 机制。考虑到 WebSocket 可以发送任意按键到 tmux 终端（包括 shell 命令），这等同于无认证的远程 shell。

**建议**: 至少实现简单的 bearer token（启动时随机生成并打印到控制台）。

### 2.3 P2: 前端 XSS (frontend.html L124-128, L138-146)

`renderSidebar` 和 `renderDashboard` 使用 `innerHTML` 插入 `role.name`、`role.description`：

```js
btn.innerHTML = `<span>${role.name}</span>`;  // L126
```

虽然 role 数据来自自身服务器而非用户输入，XSS 风险较低（攻击者需要能修改 project.yaml），但仍是不良实践。

**建议**: 使用 `textContent` 或 DOM API 构建元素。

---

## 三、综合评价

| 维度 | Loop #2 | Loop #3 | 变化 |
|------|---------|---------|------|
| 安全性 | 2/10 | 7/10 | +5（注入全部修复，绑定/认证未修） |
| 性能 | 6/10 | 9/10 | +3（PTY 直连替代 polling） |
| 综合 | 4.4/10 | 7/10 | 显著改善 |

executor 响应迅速且修复质量高。PTY 直连架构是超出预期的改进。
