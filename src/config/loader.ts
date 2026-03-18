import path from "node:path";
import fs from "node:fs";
import { readYaml } from "../utils/fs.js";
import { evomeshDir, expandHome, requireProjectRoot } from "../utils/paths.js";
import type { ProjectConfig } from "./schema.js";

// mtime-based cache: avoids re-parsing YAML when file hasn't changed
const configCache = new Map<string, { mtimeMs: number; config: ProjectConfig }>();

export function loadConfig(root?: string): ProjectConfig {
  const projectRoot = root ?? requireProjectRoot();
  const configPath = path.join(evomeshDir(projectRoot), "project.yaml");
  const backupPath = configPath + ".bak";

  // Check mtime — return cached if unchanged
  try {
    const stat = fs.statSync(configPath);
    const cached = configCache.get(configPath);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.config;
    }
  } catch {
    // stat failed — fall through to normal load (file may not exist)
  }

  try {
    const config = readYaml<ProjectConfig>(configPath);
    // Success — save known-good backup and cache
    try { fs.copyFileSync(configPath, backupPath); } catch {}
    try {
      const stat = fs.statSync(configPath);
      configCache.set(configPath, { mtimeMs: stat.mtimeMs, config });
    } catch {}
    return config;
  } catch (err) {
    // Parse failed — try backup
    configCache.delete(configPath);
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
