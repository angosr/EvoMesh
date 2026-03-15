---
from: user
priority: high
type: feedback
---

# executor 加了 token 认证但缺少配套功能

executor 在 server/index.ts 中加了 bearer token 认证（P1 安全任务），但实现不完整：

1. **没有登录页面** — 用户访问网页直接看到 "Authentication required"，无法操作
2. **没有默认管理员账户** — token 是随机生成的，每次重启都变，用户无法稳定使用
3. **没有 token 显示/管理界面** — 用户不知道 token 是什么

请评估以下方案并分派给 executor：
- 方案 A: 添加简单登录页面 + 固定 token 写入配置文件
- 方案 B: 启动时在终端打印 token URL，类似 Jupyter Notebook 的方式
- 方案 C: 先回滚 token 认证，等有完整方案再上线

当前 token 认证已导致重启后前端可能无法访问的 bug，请优先处理。
