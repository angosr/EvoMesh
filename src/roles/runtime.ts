import type { AutomationMode, RoleConfig, RoleKind } from "../config/schema.js";

export function resolveRoleKind(roleConfig: RoleConfig): RoleKind {
  return roleConfig.kind === "terminal" ? "terminal" : "agent";
}

export function resolveAutomationMode(roleConfig: RoleConfig): AutomationMode {
  if (roleConfig.automation_mode) return roleConfig.automation_mode;
  if (resolveRoleKind(roleConfig) === "terminal") return "manual";
  return (roleConfig.provider || "claude") === "claude" ? "loop" : "manual";
}

export function isAutomationModeAllowed(roleConfig: Pick<RoleConfig, "kind" | "provider">, mode: AutomationMode): boolean {
  const kind = roleConfig.kind === "terminal" ? "terminal" : "agent";
  const provider = roleConfig.provider || "claude";
  if (provider === "codex") return mode === "prompt" || mode === "manual";
  if (kind === "terminal") return mode === "manual";
  return mode === "loop" || mode === "manual";
}

export function roleAutomationInterval(roleConfig: RoleConfig): string {
  return roleConfig.loop_interval || "10m";
}

export function buildLoopCommand(roleName: string, roleConfig: RoleConfig): string {
  const roleRootRel = `.evomesh/roles/${roleName}`;
  return `/loop ${roleAutomationInterval(roleConfig)} You are the ${roleName} role. FIRST: cat and read ${roleRootRel}/ROLE.md completely. Then follow CLAUDE.md loop flow. Working directory: ${roleRootRel}/`;
}

export function buildDefaultAutomationPrompt(roleName: string, roleConfig: RoleConfig): string {
  if (resolveRoleKind(roleConfig) === "terminal") {
    return `You are using the ${roleName} terminal inside this project. Continue from the current terminal state, inspect the repository as needed, and make concrete progress on the assigned work.`;
  }
  const roleRootRel = `.evomesh/roles/${roleName}`;
  return `You are the ${roleName} role. FIRST: cat and read ${roleRootRel}/ROLE.md completely. Then follow CLAUDE.md loop flow. Working directory: ${roleRootRel}/`;
}

export function getAutomationPrompt(roleName: string, roleConfig: RoleConfig): string {
  const trimmed = roleConfig.automation_prompt?.trim();
  if (trimmed) return trimmed;
  if (resolveAutomationMode(roleConfig) !== "prompt") return "";
  return buildDefaultAutomationPrompt(roleName, roleConfig);
}
