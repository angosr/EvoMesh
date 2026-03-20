export interface McpServerConfig {
  command: string;
  args: string[];
}

export interface RoleConfig {
  type: "lead" | "worker";
  loop_interval: string;
  account: string;
  evolution_upgrade_every: number;
  scope: string[];
  description: string;
  memory?: string;  // e.g. "2g" → docker --memory
  cpus?: string;    // e.g. "1.5" → docker --cpus
  mcp?: Record<string, McpServerConfig>;  // MCP servers for this role
  launch_mode?: "docker" | "host";  // Container launch mode
  idle_policy?: "reset" | "compact" | "stop" | "ignore";  // What to do when role is idle
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
  central_account?: string; // account path for Central AI, e.g. "~/.claude" or "~/.claude2"
}
