/**
 * Provider abstraction layer — isolates all CLI-specific logic for Claude Code and Codex.
 * Every other module should use these functions instead of hardcoding CLI paths/args/dirs.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

export type ProviderName = "claude" | "codex";

export interface ProviderInfo {
  /** Display name */
  displayName: string;
  /** Binary name (for which/spawn) */
  binaryName: string;
  /** Config directory prefix under $HOME (e.g. ".claude", ".codex") */
  configDirPrefix: string;
  /** Default config directory (e.g. "~/.claude") */
  defaultConfigDir: string;
  /** Credential file name inside config dir */
  credentialFile: string;
  /** Environment variable to override config dir (null if not supported) */
  configDirEnv: string | null;
  /** CLI flag for full auto-approval */
  autoApproveFlag: string;
  /** CLI flag for model selection (null if not supported) */
  modelFlag: string | null;
  /** Available model tiers */
  models: string[];
  /** Default model */
  defaultModel: string;
  /** CLI flag/args for session resume (takes session ID) */
  resumeArgs: (sessionId: string) => string[];
  /** CLI flag/args for naming a new session */
  nameArgs: (name: string) => string[];
  /** Auth/login command args */
  loginArgs: string[];
  /** Files to copy from account dir to role config dir */
  configFiles: string[];
  /** How to check if account needs login */
  needsLogin: (accountDir: string) => boolean;
  /** Extra env vars to set when starting the CLI */
  extraEnv?: (accountDir: string) => Record<string, string>;
}

// --- Claude Code provider ---

const claudeProvider: ProviderInfo = {
  displayName: "Claude Code",
  binaryName: "claude",
  configDirPrefix: ".claude",
  defaultConfigDir: "~/.claude",
  credentialFile: ".credentials.json",
  configDirEnv: "CLAUDE_CONFIG_DIR",
  autoApproveFlag: "--dangerously-skip-permissions",
  modelFlag: "--model",
  models: ["opus", "sonnet", "haiku"],
  defaultModel: "sonnet",
  resumeArgs: (sid) => ["--resume", sid],
  nameArgs: (name) => ["--name", name],
  loginArgs: ["auth", "login", "--claudeai"],
  configFiles: [".credentials.json", ".claude.json", "settings.json"],
  needsLogin: (dir) => {
    try {
      const dotCreds = path.join(dir, ".credentials.json");
      const plainCreds = path.join(dir, "credentials.json");
      const credsPath = fs.existsSync(dotCreds) ? dotCreds : plainCreds;
      if (!fs.existsSync(credsPath)) return true;
      const creds = fs.readFileSync(credsPath, "utf-8").trim();
      return !creds || creds === "{}" || creds === "null";
    } catch { return true; }
  },
};

// --- Codex (OpenAI) provider ---

const codexProvider: ProviderInfo = {
  displayName: "Codex",
  binaryName: "codex",
  configDirPrefix: ".codex",
  defaultConfigDir: "~/.codex",
  credentialFile: "auth.json",
  configDirEnv: "CODEX_HOME",
  autoApproveFlag: "--dangerously-bypass-approvals-and-sandbox",
  modelFlag: "--model",
  models: ["gpt-5.4", "o3", "o4-mini", "gpt-4.1", "codex-mini"],
  defaultModel: "gpt-5.4",
  resumeArgs: (sid) => ["resume", sid],
  nameArgs: (_name) => [],  // codex doesn't have --name
  loginArgs: ["login"],
  configFiles: ["auth.json", "config.toml"],
  needsLogin: (dir) => {
    try {
      const authFile = path.join(dir, "auth.json");
      if (!fs.existsSync(authFile)) return true;
      const auth = JSON.parse(fs.readFileSync(authFile, "utf-8"));
      // Has either API key or OAuth tokens
      return !auth.OPENAI_API_KEY && !auth.tokens?.id_token;
    } catch { return true; }
  },
  extraEnv: (accountDir) => ({ CODEX_HOME: accountDir }),
};

// --- Provider registry ---

const providers: Record<ProviderName, ProviderInfo> = {
  claude: claudeProvider,
  codex: codexProvider,
};

export function getProvider(name: ProviderName): ProviderInfo {
  return providers[name] || providers.claude;
}

export function getProviderNames(): ProviderName[] {
  return Object.keys(providers) as ProviderName[];
}

/** Detect provider from an account directory path (e.g. "~/.claude-work" → "claude", "~/.codex" → "codex") */
export function detectProvider(accountPath: string): ProviderName {
  const base = path.basename(accountPath);
  if (base.startsWith(".codex")) return "codex";
  return "claude";
}

// --- Binary resolution (cached per provider) ---

const _binCache = new Map<ProviderName, string>();

export function findBinary(providerName: ProviderName): string {
  if (_binCache.has(providerName)) return _binCache.get(providerName)!;
  const prov = getProvider(providerName);

  // Try `which` first
  try {
    const resolved = execFileSync("readlink", ["-f",
      execFileSync("which", [prov.binaryName], { encoding: "utf-8" }).trim(),
    ], { encoding: "utf-8" }).trim();
    if (resolved && fs.existsSync(resolved)) { _binCache.set(providerName, resolved); return resolved; }
  } catch {}

  // Common locations
  const candidates = [
    path.join(os.homedir(), ".local", "bin", prov.binaryName),
    `/usr/local/bin/${prov.binaryName}`,
    `/usr/bin/${prov.binaryName}`,
  ];
  for (const c of candidates) {
    try {
      const resolved = execFileSync("readlink", ["-f", c], { encoding: "utf-8" }).trim();
      if (resolved && fs.existsSync(resolved)) { _binCache.set(providerName, resolved); return resolved; }
    } catch {}
  }

  _binCache.set(providerName, prov.binaryName);
  return prov.binaryName;
}

/** Build the CLI startup args for a role */
export function buildCLIArgs(providerName: ProviderName, opts: {
  model?: string;
  sessionId?: string;
  roleName?: string;
}): string[] {
  const prov = getProvider(providerName);
  const args: string[] = [];

  // Session resume or name
  if (opts.sessionId) {
    args.push(...prov.resumeArgs(opts.sessionId));
  } else if (opts.roleName && prov.nameArgs(opts.roleName).length) {
    args.push(...prov.nameArgs(opts.roleName));
  }

  // Model
  if (opts.model && prov.modelFlag) {
    args.push(prov.modelFlag, opts.model);
  }

  if (providerName === "codex") {
    args.push(
      "--ask-for-approval", "never",
      "--sandbox", "danger-full-access",
      "--config", 'model_reasoning_effort="high"',
    );
    return args;
  }

  // Auto-approve
  args.push(prov.autoApproveFlag);

  return args;
}

/** Build env vars for starting the CLI with a specific account dir */
export function buildCLIEnv(providerName: ProviderName, accountDir: string, isDefault: boolean): Record<string, string> {
  const prov = getProvider(providerName);
  const env: Record<string, string> = {};

  // Only set config dir env if not the default account (Claude Code quirk: setting it
  // explicitly even to ~/.claude causes different internal state file paths)
  if (!isDefault && prov.configDirEnv) {
    env[prov.configDirEnv] = accountDir;
  }

  // Provider-specific extra env
  if (prov.extraEnv) {
    Object.assign(env, prov.extraEnv(accountDir));
  }

  return env;
}

/** List account directories for a provider under a home directory */
export function listAccountDirs(homeDir: string, providerName: ProviderName): Array<{ name: string; dirName: string; fullPath: string }> {
  const prov = getProvider(providerName);
  try {
    return fs.readdirSync(homeDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith(prov.configDirPrefix))
      .map(e => ({
        name: e.name.replace(new RegExp(`^\\${prov.configDirPrefix}`), "") || "default",
        dirName: e.name,
        fullPath: path.join(homeDir, e.name),
      }));
  } catch { return []; }
}

/** Get the default account directory path for a provider */
export function defaultAccountDir(providerName: ProviderName): string {
  const prov = getProvider(providerName);
  return path.join(os.homedir(), prov.configDirPrefix);
}
