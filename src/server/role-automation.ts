import { sendInput } from "../process/container.js";
import type { RoleConfig } from "../config/schema.js";
import { getAutomationPrompt, resolveAutomationMode } from "../roles/runtime.js";

const promptTimers = new Map<string, { initial?: ReturnType<typeof setTimeout>; interval?: ReturnType<typeof setInterval> }>();

function parseDurationMs(value: string): number {
  const raw = value.trim().toLowerCase();
  const match = raw.match(/^(\d+)\s*([smhd])$/);
  if (!match) return 10 * 60 * 1000;
  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const factor = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return amount * factor;
}

export function clearRoleAutomation(key: string): void {
  const timers = promptTimers.get(key);
  if (!timers) return;
  if (timers.initial) clearTimeout(timers.initial);
  if (timers.interval) clearInterval(timers.interval);
  promptTimers.delete(key);
}

export function configureRoleAutomation(
  projectRoot: string,
  projectSlug: string,
  roleName: string,
  roleConfig: RoleConfig,
): void {
  const key = `${projectSlug}/${roleName}`;
  clearRoleAutomation(key);

  if ((roleConfig.provider || "claude") !== "codex") return;
  if (resolveAutomationMode(roleConfig) !== "prompt") return;

  const prompt = getAutomationPrompt(roleName, roleConfig);
  if (!prompt) return;

  const sendPrompt = () => {
    try {
      const delivered = sendInput(projectRoot, roleName, prompt);
      if (!delivered) {
        console.log(`[automation] ${key} not ready for prompt injection; skipped this cycle`);
      }
    } catch (e) {
      console.error(`[automation] Failed to send prompt to ${key}:`, e);
    }
  };

  const intervalMs = parseDurationMs(roleConfig.loop_interval || "10m");
  const timers: { initial?: ReturnType<typeof setTimeout>; interval?: ReturnType<typeof setInterval> } = {};
  timers.initial = setTimeout(() => {
    sendPrompt();
    timers.interval = setInterval(sendPrompt, intervalMs);
  }, intervalMs);
  promptTimers.set(key, timers);
}
