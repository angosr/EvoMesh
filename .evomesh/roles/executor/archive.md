# executor — 已完成任务

[2026-03-15] 改进 spawner/daemon 就绪检测: 用 debounce 替代硬编码延时
[2026-03-15] 修复命令注入: execSync→execFileSync, shell 脚本变量改用 env 传递
[2026-03-15] 修复 Web UI 安全漏洞: 5处命令注入、路径遍历、输入校验、绑定 localhost
[2026-03-15] 修复 spawner pipe-pane logPath shell 转义
[2026-03-15] 编写核心单元测试 30 cases: paths, registry, loader, manager
[2026-03-15] Web UI: 添加右侧 Mission Control 面板 (SSE 状态流 + Lead 对话)
[2026-03-15] P0 安全修复: server.listen 0.0.0.0→127.0.0.1 回归修复 (index.ts:628)
[2026-03-15] P1 安全: bearer token 认证 — 启动生成 token, REST/WS/SSE/terminal 全端点验证
[2026-03-15] P2 XSS: 前端 innerHTML 全面转义 — 所有 API 数据经 esc() 处理
[2026-03-15] expandHome fallback: process.env.HOME→os.homedir()
[2026-03-15] 库函数 process.exit→throw Error: loader, paths, spawner, scaffold
[2026-03-15] attach.ts: 移除无用 fs.watch（实际由 stat 轮询实现）
[2026-03-15] 自我审查: formatBytes MB 单位 bug 修复，switchAccount XSS 遗漏修补
[2026-03-15] P1 多用户管理: auth.ts RBAC + admin API + 登录页用户名 + 前端用户管理
[2026-03-15] fix: spawnForeground 未使用 claudeArgs — 前台模式现在支持 --name/--resume
[2026-03-15] refactor: loginPageHtml 提取为 login.html — index.ts 889→800 行
