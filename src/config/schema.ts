export interface McpServerConfig {
  command: string;
  args: string[];
}

export type ProviderType = "claude" | "codex";
export type RoleKind = "agent" | "terminal";
export type AutomationMode = "loop" | "prompt" | "manual";

export interface AccountProfile {
  provider: ProviderType;
  path: string;
  label?: string;
}

export interface RoleConfig {
  type: "lead" | "worker";
  loop_interval: string;
  account?: string; // legacy account alias
  account_profile?: string;
  evolution_upgrade_every: number;
  scope: string[];
  description: string;
  kind?: RoleKind;
  memory?: string;  // e.g. "2g" → docker --memory
  cpus?: string;    // e.g. "1.5" → docker --cpus
  mcp?: Record<string, McpServerConfig>;  // MCP servers for this role
  launch_mode?: "docker" | "host";  // Container launch mode
  idle_policy?: "reset" | "compact" | "ignore";  // Idle policy; default: ignore
  provider?: ProviderType;  // AI CLI provider; default: "claude"
  model?: string;   // Model name (provider-specific); default varies by provider
  automation_mode?: AutomationMode;
  automation_prompt?: string;
}

export interface Claim {
  id: string;
  task: string;
  priority: "P0" | "P1" | "P2";
  assignedBy: string;
  assignedTo: string;
  status: "unclaimed" | "in-progress" | "blocked" | "in-review" | "completed";
  claimedAt: string | null;
  lastActivityAt: string;
  notes: string[];
  blockedReason: string | null;
  inboxRef: string | null;
}

export interface ClaimsData {
  claims: Claim[];
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
  accounts?: Record<string, string>; // legacy account alias map
  account_profiles?: Record<string, AccountProfile>;
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
