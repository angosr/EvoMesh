import path from "node:path";
import fs from "node:fs";
import { readYaml } from "../utils/fs.js";
import { evomeshDir, expandHome, requireProjectRoot } from "../utils/paths.js";
import type { ProjectConfig } from "./schema.js";

export function loadConfig(root?: string): ProjectConfig {
  const projectRoot = root ?? requireProjectRoot();
  const configPath = path.join(evomeshDir(projectRoot), "project.yaml");
  const backupPath = configPath + ".bak";
  try {
    const config = readYaml<ProjectConfig>(configPath);
    // Success — save known-good backup
    try { fs.copyFileSync(configPath, backupPath); } catch {}
    return config;
  } catch (err) {
    // Parse failed — try backup
    try {
      const backup = readYaml<ProjectConfig>(backupPath);
      console.warn(`[config] project.yaml corrupt, using backup: ${(err as Error).message}`);
      return backup;
    } catch {
      throw err; // both failed — propagate original error
    }
  }
}

export function resolveAccountPath(
  config: ProjectConfig,
  accountName: string
): string {
  const raw = config.accounts[accountName];
  if (!raw) {
    throw new Error(`Account "${accountName}" not found in project.yaml`);
  }
  return expandHome(raw);
}
