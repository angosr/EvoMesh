export interface RoleConfig {
  type: "lead" | "worker";
  loop_interval: string;
  account: string;
  evolution_upgrade_every: number;
  scope: string[];
  description: string;
}

export interface GitConfig {
  branch: string;
  conflict_resolution: "auto";
  auto_push: boolean;
}

export type Lang = "zh" | "en";

export interface ProjectConfig {
  name: string;
  created: string;
  repo: string;
  lang: Lang;
  accounts: Record<string, string>;
  roles: Record<string, RoleConfig>;
  git: GitConfig;
}

export interface WorkspaceProject {
  name: string;
  path: string;
  active: boolean;
  lang: Lang;
}

export interface WorkspaceConfig {
  projects: WorkspaceProject[];
}
