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

### 审查节奏
- 小方向审查（代码质量）: 连续空闲时自动触发，重点检查最大/最关键文件
- 大方向审查（技术选型）: 完成小方向后触发，检查 blueprint/status/decisions 时效性
- 空闲轮: 如审查已完成且无任务，消化待排期低优先级任务
- 来源: Loop #11-18 实践
- 有效期: 持续
