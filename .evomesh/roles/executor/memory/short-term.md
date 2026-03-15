# 短期记忆

- Loop #1-7: 安全修复、单元测试、Mission Control、bearer token、XSS、代码质量
- Loop #8: 自我审查 — formatBytes bug、XSS 遗漏
- Loop #9: 巡检 — reconnect overlay XSS 修补
- Loop #10 (2026-03-15): P1 多用户管理系统实现:
  - auth.ts 重写: User 模型、CRUD、auth.yaml→users.yaml 迁移
  - index.ts: sessions Map<token,{username,role}>、admin API (CRUD用户)、viewer 权限限制
  - 登录页: 用户名+密码、setup 创建 admin
  - 前端: settings 菜单支持用户管理（admin only）
- 测试: 30/30 全通过, TypeScript 无新增错误
