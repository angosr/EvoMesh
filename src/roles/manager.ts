import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { roleDir, rolesDir } from "../utils/paths.js";
import { ensureDir, writeFile, exists, listDirs, writeYaml } from "../utils/fs.js";
import type { ProjectConfig, RoleConfig } from "../config/schema.js";

/**
 * Read a role template file. Checks global ~/.evomesh/templates/roles/ first,
 * then project-local .evomesh/templates/roles/.
 */
function readRoleTemplate(templateName: string): string | null {
  const filename = `${templateName}.md.tmpl`;
  const candidates = [
    path.join(os.homedir(), ".evomesh", "templates", "roles", filename),
    path.join(".evomesh", "templates", "roles", filename),
    path.join("defaults", "templates", "roles", filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8");
  }
  return null;
}

/**
 * Load role default configs from defaults.json.
 */
function loadRoleDefaults(): Record<string, Omit<RoleConfig, "account">> {
  const paths = [
    path.join(os.homedir(), ".evomesh", "templates", "roles", "defaults.json"),
    path.join(".evomesh", "templates", "roles", "defaults.json"),
    path.join("defaults", "templates", "roles", "defaults.json"),
  ];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {}
  }
  return {};
}

/** Available template names (from defaults.json keys). */
export function getTemplateNames(): string[] {
  return Object.keys(loadRoleDefaults());
}

export function createRole(
  root: string,
  name: string,
  templateName: string,
  config: ProjectConfig,
  account: string = "main"
): void {
  const defaults = loadRoleDefaults();
  const defaultConfig = defaults[templateName];
  if (!defaultConfig) {
    throw new Error(`Unknown template: ${templateName}. Available: ${Object.keys(defaults).join(", ")}`);
  }

  const dir = roleDir(root, name);
  if (exists(dir)) {
    throw new Error(`Role "${name}" already exists.`);
  }

  // Create directory structure
  ensureDir(dir);
  ensureDir(path.join(dir, "inbox", "processed"));
  ensureDir(path.join(dir, "memory"));

  // Write ROLE.md from template or fallback
  const tmpl = readRoleTemplate(templateName);
  const roleMd = tmpl || `# ${name}\n\n> **Foundation**: Follow \`.evomesh/templates/base-protocol.md\`\n`;
  writeFile(path.join(dir, "ROLE.md"), roleMd);

  // Write scaffolding files
  writeFile(path.join(dir, "todo.md"), `# ${name} — Tasks\n\n(no tasks)\n`);
  writeFile(path.join(dir, "archive.md"), `# ${name} — Completed\n\n(none)\n`);
  writeFile(path.join(dir, "evolution.log"), `# ${name} — Evolution Log\n\n(none)\n`);
  writeFile(path.join(dir, "memory", "short-term.md"), "# Short-term Memory\n\n(empty)\n");
  writeFile(path.join(dir, "memory", "long-term.md"), "# Long-term Memory\n\n(empty)\n");

  // Update project.yaml
  const roleConfig: RoleConfig = { ...defaultConfig, account } as RoleConfig;
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
