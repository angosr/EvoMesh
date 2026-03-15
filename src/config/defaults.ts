import type { GitConfig, ProjectConfig } from "./schema.js";

export const DEFAULT_GIT: GitConfig = {
  branch: "main",
  conflict_resolution: "auto",
  auto_push: true,
};

export function defaultConfig(name: string): ProjectConfig {
  const today = new Date().toISOString().slice(0, 10);
  return {
    name,
    created: today,
    repo: "",
    accounts: {
      main: "~/.claude",
    },
    roles: {},
    git: DEFAULT_GIT,
  };
}
