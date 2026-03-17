import fs from "node:fs";
import path from "node:path";
import { roleDir, rolesDir } from "../utils/paths.js";
import { ensureDir, writeFile, exists, listDirs, writeYaml } from "../utils/fs.js";
import { TEMPLATES } from "./templates/index.js";
import type { ProjectConfig, RoleConfig } from "../config/schema.js";

export function createRole(
  root: string,
  name: string,
  templateName: string,
  config: ProjectConfig,
  account: string = "main"
): void {
  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(`Unknown template: ${templateName}. Available: ${Object.keys(TEMPLATES).join(", ")}`);
  }

  const dir = roleDir(root, name);
  if (exists(dir)) {
    throw new Error(`Role "${name}" already exists.`);
  }

  // Create directory structure
  ensureDir(dir);
  ensureDir(path.join(dir, "inbox", "processed"));
  ensureDir(path.join(dir, "memory"));
  ensureDir(path.join(dir, "skills"));

  // Write role files
  writeFile(path.join(dir, "ROLE.md"), template.roleMd(config.name));
  writeFile(path.join(dir, "loop.md"), template.loopMd());
  writeFile(path.join(dir, "todo.md"), `# ${name} — Tasks\n\n(no tasks)\n`);
  writeFile(path.join(dir, "archive.md"), `# ${name} — Completed\n\n(none)\n`);
  writeFile(path.join(dir, "evolution.log"), `# ${name} — Evolution Log\n\n(none)\n`);
  writeFile(path.join(dir, "memory", "short-term.md"), "# Short-term Memory\n\n(empty)\n");
  writeFile(path.join(dir, "memory", "long-term.md"), "# Long-term Memory\n\n(empty)\n");

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
    throw new Error(`Role "${name}" does not exist.`);
  }

  fs.rmSync(dir, { recursive: true });

  delete config.roles[name];
  writeYaml(path.join(root, ".evomesh", "project.yaml"), config);
}

export function listRoles(root: string): string[] {
  return listDirs(rolesDir(root));
}
