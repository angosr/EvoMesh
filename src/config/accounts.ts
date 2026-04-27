import os from "node:os";
import path from "node:path";
import { defaultAccountDir, detectProvider } from "../provider.js";
import { expandHome } from "../utils/paths.js";
import type { AccountProfile, ProjectConfig, ProviderType, RoleConfig } from "./schema.js";

export interface ResolvedRoleAccount {
  profileId: string | null;
  provider: ProviderType;
  label: string;
  rawPath: string;
  path: string;
  isDefault: boolean;
}

function accountIdBase(provider: ProviderType, label: string): string {
  const slug = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `${provider}_${slug || "account"}`;
}

function toStoredPath(accountPath: string): string {
  const homeDir = os.homedir();
  const resolved = path.resolve(expandHome(accountPath));
  if (resolved === homeDir) return "~";
  if (resolved.startsWith(homeDir + path.sep)) {
    return `~/${path.relative(homeDir, resolved).replace(/\\/g, "/")}`;
  }
  return accountPath;
}

export function deriveAccountLabel(provider: ProviderType, accountPath: string, preferred?: string): string {
  const custom = preferred?.trim();
  if (custom) return custom;
  const resolved = expandHome(accountPath);
  if (resolved === defaultAccountDir(provider)) return "default";
  const base = path.basename(resolved);
  const prefix = provider === "codex" ? ".codex-" : ".claude-";
  if (base.startsWith(prefix)) return base.slice(prefix.length) || "default";
  if (base === (provider === "codex" ? ".codex" : ".claude")) return "default";
  return base;
}

function legacyProfiles(config: ProjectConfig): Record<string, AccountProfile> {
  const profiles: Record<string, AccountProfile> = {};
  for (const [key, rawPath] of Object.entries(config.accounts || {})) {
    profiles[key] = {
      provider: detectProvider(rawPath),
      path: rawPath,
      label: key,
    };
  }
  return profiles;
}

export function getAccountProfiles(config: ProjectConfig): Record<string, AccountProfile> {
  return {
    ...legacyProfiles(config),
    ...(config.account_profiles || {}),
  };
}

export function normalizeAccountProfiles(config: ProjectConfig): Record<string, AccountProfile> {
  const profiles = getAccountProfiles(config);
  config.account_profiles = profiles;
  return profiles;
}

export function ensureAccountProfile(
  config: ProjectConfig,
  provider: ProviderType,
  accountPath: string,
  preferredLabel?: string,
): string {
  const profiles = normalizeAccountProfiles(config);
  const rawPath = toStoredPath(accountPath);
  const resolvedPath = expandHome(rawPath);

  for (const [profileId, profile] of Object.entries(profiles)) {
    if (profile.provider === provider && expandHome(profile.path) === resolvedPath) {
      if (!profile.label) profile.label = deriveAccountLabel(provider, rawPath, preferredLabel);
      return profileId;
    }
  }

  const label = deriveAccountLabel(provider, rawPath, preferredLabel);
  const baseId = accountIdBase(provider, label);
  let profileId = baseId;
  let suffix = 2;
  while (profiles[profileId]) {
    profileId = `${baseId}_${suffix++}`;
  }
  profiles[profileId] = { provider, path: rawPath, label };
  return profileId;
}

export function clearRoleAccountBinding(roleConfig: RoleConfig): void {
  roleConfig.account_profile = undefined;
  roleConfig.account = undefined;
}

export function assignRoleAccountProfile(roleConfig: RoleConfig, profileId: string | null | undefined): void {
  roleConfig.account_profile = profileId || undefined;
  roleConfig.account = undefined;
}

export function resolveRoleAccount(config: ProjectConfig, roleConfig: RoleConfig): ResolvedRoleAccount {
  const provider = roleConfig.provider || "claude";
  const profiles = getAccountProfiles(config);
  const boundProfileId = roleConfig.account_profile || roleConfig.account || null;
  if (boundProfileId) {
    const profile = profiles[boundProfileId];
    if (profile && profile.provider === provider) {
      return {
        profileId: boundProfileId,
        provider,
        label: profile.label || deriveAccountLabel(provider, profile.path),
        rawPath: profile.path,
        path: expandHome(profile.path),
        isDefault: false,
      };
    }
  }

  const rawPath = provider === "codex" ? "~/.codex" : "~/.claude";
  return {
    profileId: null,
    provider,
    label: "provider default",
    rawPath,
    path: defaultAccountDir(provider),
    isDefault: true,
  };
}
