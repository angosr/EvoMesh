# 短期记忆

- Loop #1-3: spawner debounce + 安全修复全套
- Loop #4: 核心单元测试 30 cases 全通过
- Loop #4 续: 实现 Mission Control 右侧面板
- Loop #5: 修复 P0 安全回归 — server.listen 绑定地址
- Loop #6: 实现 bearer token 认证（后被 lead 替换为密码认证系统 auth.ts）
- Loop #7: innerHTML XSS 修复 + expandHome + process.exit→throw + attach.ts 清理
- Loop #8 (2026-03-15): 自我审查 — formatBytes MB→GB bug 修复，XSS 遗漏修补，readYaml zod 降级
- 用户决策: 0.0.0.0 绑定是正确的（远程 EC2），安全通过密码认证保护（见 shared/decisions.md）
- 测试框架: node:test + tsx, 命令 `npm test`, 全 30 cases 通过
- Lead 已接管认证系统: auth.ts (pbkdf2 密码 + session token), serve.ts 无 --token 参数
