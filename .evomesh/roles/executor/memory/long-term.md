# 长期记忆

### Git pull 冲突处理
- 工作目录经常存在非本角色的未暂存变更（project.yaml、已删除的 reviewer 角色文件）
- 必须先 `git stash` 再 `pull --rebase`，然后 `git stash pop`
- 来源: Loop #11 起每轮遇到
- 有效期: 持续

### 文件拆分模式
- server 文件拆分使用 `ServerContext` 接口传递共享状态（sessions、ttydProcesses、helpers）
- 前端文件拆分使用 `resolveAsset()` 辅助函数解析 src/ 或 dist/ 路径
- `/app.css` 和 `/app.js` 路由 serve 拆分后的前端资产
- 来源: Loop #15, #19
- 有效期: 持续

### 代码规范经验
- 单文件 1000 行上限是硬性约束；接近 800 行时应主动评估拆分
- 空 catch {} 是本项目常见模式（ttyd/tmux 操作可能失败），但应限制在确实可忽略的场景
- commit message 禁止 Co-Authored-By（ROLE.md 2.2 明确规定）
- archive.md 格式: `[{date}] {summary}`（无 commit hash，因 archive 在 commit 前写入）
- 来源: Loop #1-20
- 有效期: 持续

### 权限系统架构
- 系统角色 (auth.ts): admin | user — 控制系统级操作
- 项目角色 (acl.ts): owner | member | viewer — 控制项目级操作
- admin 隐含所有项目的 owner 权限
- 权限检查: requireProjectRole(req, res, projectPath, minRole) 在 routes.ts 每个端点
- ACL 存储: ~/.evomesh/acl.yaml, 启动时自动迁移
- 前端通过 API 返回的 myRole 字段控制 UI 显隐
- 来源: Loop #35-41 (P0+P2)
- 有效期: 持续

### 双轨进程管理
- CLI: tmux/spawner.ts（本地开发调试）
- Web: docker/container.ts（生产多用户）
- 共享角色目录结构，差异仅在进程管理层
- spawner.ts 不可删除，CLI commands 依赖
- 来源: Loop #37, lead 架构决策
- 有效期: 持续

### 审查节奏
- 小方向审查（代码质量）: 连续空闲时自动触发，重点检查最大/最关键文件
- 大方向审查（技术选型）: 完成小方向后触发，检查 blueprint/status/decisions 时效性
- 空闲轮: 如审查已完成且无任务，消化待排期低优先级任务
- 来源: Loop #11-18 实践
- 有效期: 持续
