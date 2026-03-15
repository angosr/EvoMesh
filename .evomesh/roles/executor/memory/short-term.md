# 短期记忆

- Loop #1-18: 安全、测试、多用户、代码审查、重构、CI、文档
- Loop #19: 拆分 frontend.html → html + css + js
- Loop #20: 强制全面审查，ROLE.md 微调，长期记忆沉淀
- Loop #21: 空闲轮
- Loop #22 (2026-03-15): auth.ts 单元测试 18 cases:
  - setupAdmin, verifyUser, changePassword, addUser, deleteUser, resetPassword
  - generateSessionToken, listUsers (无敏感数据泄漏), migrateIfNeeded
  - 使用 HOME 环境变量隔离测试，不污染真实用户数据
- 测试: 48/48 全通过 (原30 + 新18), TypeScript 无错误
