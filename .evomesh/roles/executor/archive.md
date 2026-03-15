# executor — 已完成任务

[2026-03-15] 改进 spawner/daemon 就绪检测: 用 debounce 替代硬编码延时
[2026-03-15] 修复命令注入: execSync→execFileSync, shell 脚本变量改用 env 传递
[2026-03-15] 修复 Web UI 安全漏洞: 5处命令注入、路径遍历、输入校验、绑定 localhost
[2026-03-15] 修复 spawner pipe-pane logPath shell 转义
