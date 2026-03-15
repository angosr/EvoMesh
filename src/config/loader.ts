import path from "node:path";
import { readYaml } from "../utils/fs.js";
import { evomeshDir, expandHome, requireProjectRoot } from "../utils/paths.js";
import type { ProjectConfig } from "./schema.js";

export function loadConfig(root?: string): ProjectConfig {
  const projectRoot = root ?? requireProjectRoot();
  const configPath = path.join(evomeshDir(projectRoot), "project.yaml");
  return readYaml<ProjectConfig>(configPath);
}

export function resolveAccountPath(
  config: ProjectConfig,
  accountName: string
): string {
  const raw = config.accounts[accountName];
  if (!raw) {
    console.error(`Account "${accountName}" not found in project.yaml`);
    process.exit(1);
  }
  return expandHome(raw);
}
