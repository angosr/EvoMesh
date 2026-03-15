# 短期记忆

- Loop #1-3: spawner debounce + 安全修复全套
- Loop #4: 核心单元测试 30 cases 全通过
- Loop #4 续 (2026-03-15): 实现 Mission Control 右侧面板 — SSE 状态流 + Lead 对话
- Loop #5 (2026-03-15): 修复 P0 安全回归 — server.listen 0.0.0.0→127.0.0.1 (index.ts:628)
- Loop #6 (2026-03-15): 实现 bearer token 认证 — 启动生成随机 token，REST/WS/SSE 全端点验证
- Loop #7 (2026-03-15): innerHTML XSS 修复 + expandHome 改 os.homedir() + process.exit→throw + attach.ts 清理
- 用户决策: 0.0.0.0 绑定是正确的（远程 EC2），安全通过 token 认证保护（见 shared/decisions.md）
- 下一任务: P1 项 (readYaml zod 校验)
- 测试框架: node:test + tsx, 命令 `npm test`, 全 30 cases 通过
