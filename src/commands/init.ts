import path from "node:path";
import { Command } from "commander";
import { scaffoldProject } from "../scaffold/init.js";
import { createRole } from "../roles/manager.js";
import { loadConfig } from "../config/loader.js";
import { writeFile } from "../utils/fs.js";

export const initCommand = new Command("init")
  .description("Initialize a new EvoMesh project")
  .argument("[name]", "Project name", path.basename(process.cwd()))
  .action((name: string) => {
    const root = process.cwd();
    const result = scaffoldProject(root, name);

    if (result.hasExistingRoles) {
      // Existing role designs found → create lead with bootstrap task
      const config = loadConfig(root);
      createRole(root, "lead", "lead", config);

      // Write bootstrap task to lead's todo.md
      const todoPath = path.join(root, ".evomesh", "roles", "lead", "todo.md");
      writeFile(todoPath, `# lead — 待办任务

## 🔴 高优先级

### 引导任务：基于已有角色设计创建项目角色

读取 \`.evomesh/bootstrap-context.md\`，其中包含在本项目中检测到的已有角色设计文件。

**执行步骤**：
1. 分析 bootstrap-context.md 中的每个角色设计，理解其职责和项目特定内容
2. 规划本项目需要的 EvoMesh 角色（必须有一个 lead，其余为 worker）
3. 对于每个需要的 worker 角色：
   - 使用最接近的模板创建: 在项目根目录执行 \`evomesh role create <name> --from <executor|reviewer>\`
   - 修改生成的 ROLE.md，将已有设计中的项目特定内容（技术栈约束、代码规范、业务规则等）融入
4. 更新自身 ROLE.md，融入已有设计中对 lead 角色的项目特定要求
5. 更新 blueprint.md 和 status.md
6. 完成后删除 .evomesh/bootstrap-context.md

**检测到的文件**：
${result.detected.map(d => `- \`${d.path}\` (${d.source})`).join("\n")}
`);

      console.log(`\n  EvoMesh project "${name}" initialized.`);
      console.log(`\n  ✦ 检测到 ${result.detected.length} 个已有角色设计文件：`);
      for (const d of result.detected) {
        console.log(`    - ${d.path} (${d.source})`);
      }
      console.log(`\n  已创建 lead 角色，引导上下文已写入 .evomesh/bootstrap-context.md`);
      console.log(`  Lead 将在首次 Loop 时分析已有设计并创建适配的角色。`);
      console.log(`\n  Next steps:`);
      console.log(`    evomesh start lead`);
      console.log(`    # Lead 会自动分析并创建其他角色\n`);
    } else {
      // No existing roles → create default lead + executor
      const config = loadConfig(root);
      createRole(root, "lead", "lead", config);
      // Reload config after lead creation
      const updatedConfig = loadConfig(root);
      createRole(root, "executor", "executor", updatedConfig);

      console.log(`\n  EvoMesh project "${name}" initialized.`);
      console.log(`\n  未检测到已有角色设计，已创建默认角色: lead, executor`);
      console.log(`\n  Next steps:`);
      console.log(`    evomesh start\n`);
    }
  });
