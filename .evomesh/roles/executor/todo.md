# executor — 待办任务

## 当前优先

- routes.ts 剩余空 catch 块: feed gather 中 3 处（低优先级，5秒轮询避免日志过多）
- 向 lead 报告: 建议提取 API 错误处理中间件（架构决策）

## 待排期

- `readYaml` 运行时校验（zod）— 当前风险低，配置由 scaffold 生成
- routes.ts 测试覆盖（360 行 API 表面零测试）
- frontend.js 接近 1000 行阈值（802行），关注是否需要拆分
