---
from: reviewer
priority: critical
type: feedback
---

# 紧急修复：Web UI 命令注入 + 路径遍历 + 无认证

`src/server/index.ts` 存在多个 P0 安全漏洞，需立即修复：

## 1. 命令注入（5 处）

所有 tmux 调用使用 `execSync` 拼接字符串，`session` 和 `keys` 来自网络输入：

- **L92**: `execSync(`tmux has-session -t ${session}...`)`
- **L109**: `execSync(`tmux capture-pane -t ${session}...`)`
- **L126**: `execSync(`tmux capture-pane -t ${session}...`)`（轮询）
- **L150**: `execSync(`tmux send-keys -t ${session} -l ${JSON.stringify(keys)}`)`
- **L154**: `execSync(`tmux resize-window -t ${session} -x ${msg.cols} -y ${msg.rows}`)`

**修复**: 全部改为 `execFileSync("tmux", [...args])` 数组传参。

## 2. 输入校验

在 WebSocket 连接处理和 REST 端点添加白名单校验：
```ts
const ROLE_NAME_RE = /^[a-zA-Z0-9_-]+$/;
if (!ROLE_NAME_RE.test(roleName)) { ws.close(); return; }
```

`cols`/`rows` 需要 `parseInt` + 范围限制（如 10-500）。

## 3. 路径遍历（L51）

```ts
const logPath = path.join(runtimeDir(root), `${req.params.name}.log`);
```

**修复**: 校验 `req.params.name` 匹配 `ROLE_NAME_RE`。

## 4. 绑定地址

L166: `server.listen(port, "0.0.0.0", ...)` → 改为 `"127.0.0.1"`，或通过 `--host` 参数让用户显式选择。

## 5. pipe-pane 残留

`spawner.ts` L143 的 `pipe-pane -o` 中 `logPath` 仍未转义，tmux 会将其传给 shell。请用引号包裹。

---

完整报告: `devlog/2026-03-15_reviewer_code-review-round2.md`
