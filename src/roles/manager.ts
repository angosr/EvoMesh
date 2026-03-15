import fs from "node:fs";
import path from "node:path";
import { roleDir, rolesDir } from "../utils/paths.js";
import { ensureDir, writeFile, exists, listDirs, writeYaml } from "../utils/fs.js";
import { TEMPLATES, getTemplates } from "./templates/index.js";
import type { ProjectConfig, RoleConfig, Lang } from "../config/schema.js";

export function createRole(
  root: string,
  name: string,
  templateName: string,
  config: ProjectConfig,
  account: string = "main"
): void {
  const lang: Lang = config.lang || "zh";
  const templates = getTemplates(lang);
  const template = templates[templateName];
  if (!template) {
    console.error(
      `Unknown template: ${templateName}. Available: ${Object.keys(TEMPLATES).join(", ")}`
    );
    process.exit(1);
  }

  const dir = roleDir(root, name);
  if (exists(dir)) {
    console.error(`Role "${name}" already exists.`);
    process.exit(1);
  }

  // Create directory structure
  ensureDir(dir);
  ensureDir(path.join(dir, "inbox", "processed"));
  ensureDir(path.join(dir, "memory"));
  ensureDir(path.join(dir, "skills"));

  // Write role files
  writeFile(path.join(dir, "ROLE.md"), template.roleMd(config.name));
  writeFile(path.join(dir, "loop.md"), template.loopMd());
  writeFile(path.join(dir, "todo.md"), `# ${name} — 待办任务\n\n（暂无任务）\n`);
  writeFile(
    path.join(dir, "archive.md"),
    `# ${name} — 已完成任务\n\n（暂无记录）\n`
  );
  writeFile(path.join(dir, "evolution.log"), `# ${name} — 演进日志\n\n（暂无记录）\n`);
  writeFile(
    path.join(dir, "memory", "short-term.md"),
    `# 短期记忆\n\n（空）\n`
  );
  writeFile(
    path.join(dir, "memory", "long-term.md"),
    `# 长期记忆\n\n（空）\n`
  );

  // Update project.yaml
  const roleConfig: RoleConfig = {
    ...template.defaultConfig,
    account,
  };
  config.roles[name] = roleConfig;
  writeYaml(path.join(root, ".evomesh", "project.yaml"), config);
}

export function deleteRole(root: string, name: string, config: ProjectConfig): void {
  const dir = roleDir(root, name);
  if (!exists(dir)) {
    console.error(`Role "${name}" does not exist.`);
    process.exit(1);
  }

  fs.rmSync(dir, { recursive: true });

  delete config.roles[name];
  writeYaml(path.join(root, ".evomesh", "project.yaml"), config);
}

export function listRoles(root: string): string[] {
  return listDirs(rolesDir(root));
}
