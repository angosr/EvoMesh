# executor — 待办任务

## 当前优先

（无紧急任务）

## 待排期

- `readYaml` 运行时校验（zod）— 当前风险低，配置由 scaffold 生成
- frontend.js 接近 1000 行阈值（802行），关注是否需要拆分
- routes.ts feed gather 中 3 处空 catch（低优先级，5秒轮询避免日志过多）
