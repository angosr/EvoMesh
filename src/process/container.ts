import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { expandHome } from "../utils/paths.js";
import { ensureDir } from "../utils/fs.js";
import type { ProjectConfig, RoleConfig } from "../config/schema.js";

export interface ContainerRole {
  role: string;
  containerName: string;
  ttydPort: number;
}

const ROLE_CONFIGS_DIR = path.join(os.homedir(), ".evomesh", "role-configs");
const DOCKER_IMAGE = "evomesh-role";

function containerName(projectSlug: string, roleName: string): string {
  return `evomesh-${projectSlug}-${roleName}`;
}

function roleConfigDir(projectSlug: string, roleName: string): string {
  return path.join(ROLE_CONFIGS_DIR, `${projectSlug}-${roleName}`);
}

function slugify(root: string): string {
  return path.basename(root).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}

/**
 * Ensure the per-role config directory exists with correct credentials.
 */
function ensureRoleConfig(
  projectSlug: string,
  roleName: string,
  accountPath: string
): string {
  const configDir = roleConfigDir(projectSlug, roleName);
  ensureDir(configDir);

  // Copy credentials from account if not present or account changed
  const srcCreds = path.join(accountPath, ".credentials.json");
  const dstCreds = path.join(configDir, ".credentials.json");
  if (fs.existsSync(srcCreds)) {
    fs.copyFileSync(srcCreds, dstCreds);
  }

  // Copy .claude.json (settings/state) from account
  const srcConfig = path.join(accountPath, ".claude.json");
  const dstConfig = path.join(configDir, ".claude.json");
  if (fs.existsSync(srcConfig) && !fs.existsSync(dstConfig)) {
    fs.copyFileSync(srcConfig, dstConfig);
  }

  return configDir;
}

/**
 * Check if Docker image exists, build if not.
 */
export function ensureImage(): void {
  try {
    execFileSync("docker", ["image", "inspect", DOCKER_IMAGE], { stdio: "ignore" });
  } catch {
    console.log("Building evomesh-role Docker image...");
    const dockerDir = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "docker");
    execFileSync("docker", [
      "build",
      "--build-arg", `USER_UID=${process.getuid?.() || 1000}`,
      "--build-arg", `USER_GID=${process.getgid?.() || 1000}`,
      "-t", DOCKER_IMAGE,
      dockerDir,
    ], { stdio: "inherit", timeout: 300000 });
  }
}

/**
 * Get container state.
 */
export function getContainerState(name: string): "running" | "stopped" | "not-found" {
  try {
    const out = execFileSync("docker", ["inspect", "--format", "{{.State.Running}}", name], {
      encoding: "utf-8",
    }).trim();
    return out === "true" ? "running" : "stopped";
  } catch {
    return "not-found";
  }
}

/**
 * Get container's mapped ttyd port.
 */
export function getContainerPort(name: string): number | null {
  try {
    const out = execFileSync("docker", [
      "inspect", "--format", "{{(index (index .NetworkSettings.Ports \"7681/tcp\") 0).HostPort}}", name,
    ], { encoding: "utf-8" }).trim();
    return parseInt(out, 10) || null;
  } catch {
    return null;
  }
}

/**
 * Start a role in a Docker container.
 */
export function startRole(
  root: string,
  roleName: string,
  roleConfig: RoleConfig,
  config: ProjectConfig,
  ttydPort: number
): ContainerRole {
  const projectSlug = slugify(root);
  const name = containerName(projectSlug, roleName);
  const accountPath = expandHome(config.accounts[roleConfig.account] || "~/.claude");

  // Ensure role config directory with credentials
  const configDir = ensureRoleConfig(projectSlug, roleName, accountPath);

  // Stop/remove existing container
  try { execFileSync("docker", ["rm", "-f", name], { stdio: "ignore" }); } catch {}

  // Build docker args
  const args = [
    "run", "-d",
    "--name", name,
    "--hostname", roleName,
    "-p", `127.0.0.1:${ttydPort}:7681`,
    // Volume mounts
    "-v", `${path.resolve(root)}:/project:rw`,
    "-v", `${configDir}:/home/evomesh/.claude:rw`,
  ];

  // Git config (optional)
  const gitconfig = path.join(os.homedir(), ".gitconfig");
  if (fs.existsSync(gitconfig)) {
    args.push("-v", `${gitconfig}:/home/evomesh/.gitconfig:ro`);
  }

  // SSH keys (optional)
  const sshDir = path.join(os.homedir(), ".ssh");
  if (fs.existsSync(sshDir)) {
    args.push("-v", `${sshDir}:/home/evomesh/.ssh:ro`);
  }

  // Environment
  args.push("-e", `ROLE_NAME=${roleName}`);
  args.push("-e", `LOOP_INTERVAL=${roleConfig.loop_interval || "10m"}`);

  const roleRoot = `.evomesh/roles/${roleName}`;
  args.push("-e", `LOOP_PROMPT=你是 ${roleName} 角色。执行 ${roleRoot}/ROLE.md 工作目录: ${roleRoot}/`);

  // Resource limits
  if (roleConfig.memory) args.push("--memory", roleConfig.memory);
  if (roleConfig.cpus) args.push("--cpus", roleConfig.cpus);

  // Logging
  args.push("--log-opt", "max-size=10m", "--log-opt", "max-file=3");

  // Image
  args.push(DOCKER_IMAGE);

  execFileSync("docker", args, { stdio: "inherit" });

  return { role: roleName, containerName: name, ttydPort };
}

/**
 * Stop a role's container.
 */
export function stopRole(root: string, roleName: string): boolean {
  const name = containerName(slugify(root), roleName);
  try {
    execFileSync("docker", ["stop", "-t", "15", name], { stdio: "ignore" });
    execFileSync("docker", ["rm", name], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Restart a role's container.
 */
export function restartRole(root: string, roleName: string): boolean {
  const name = containerName(slugify(root), roleName);
  try {
    execFileSync("docker", ["restart", "-t", "15", name], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a role is running.
 */
export function isRoleRunning(root: string, roleName: string): boolean {
  return getContainerState(containerName(slugify(root), roleName)) === "running";
}

/**
 * Get container logs.
 */
export function getRoleLogs(root: string, roleName: string, tail: number = 500): string {
  const name = containerName(slugify(root), roleName);
  try {
    return execFileSync("docker", ["logs", "--tail", String(tail), name], {
      encoding: "utf-8", maxBuffer: 1024 * 1024,
    });
  } catch {
    return "";
  }
}

/**
 * Send input to the running claude process via docker exec.
 */
export function sendInput(root: string, roleName: string, input: string): boolean {
  const name = containerName(slugify(root), roleName);
  try {
    // Write to ttyd's stdin via the container's PID 1 fd
    execFileSync("docker", ["exec", name, "sh", "-c", `printf '%s\n' "${input.replace(/"/g, '\\"')}" > /proc/1/fd/0`], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Switch account for a role. Copies new credentials, preserves session.
 */
export function switchAccount(
  root: string,
  roleName: string,
  newAccountPath: string
): void {
  const projectSlug = slugify(root);
  const configDir = roleConfigDir(projectSlug, roleName);

  // Only copy credentials — session history stays
  const srcCreds = path.join(newAccountPath, ".credentials.json");
  const dstCreds = path.join(configDir, ".credentials.json");
  if (fs.existsSync(srcCreds)) {
    fs.copyFileSync(srcCreds, dstCreds);
  }

  const srcConfig = path.join(newAccountPath, ".claude.json");
  const dstConfig = path.join(configDir, ".claude.json");
  if (fs.existsSync(srcConfig)) {
    fs.copyFileSync(srcConfig, dstConfig);
  }
}

/**
 * List all evomesh containers.
 */
export function listContainers(): Array<{ name: string; state: string; port: number | null }> {
  try {
    const out = execFileSync("docker", [
      "ps", "-a", "--filter", "name=evomesh-", "--format", "{{.Names}}\t{{.State}}\t{{.Ports}}",
    ], { encoding: "utf-8" });
    return out.trim().split("\n").filter(Boolean).map(line => {
      const [name, state, ports] = line.split("\t");
      const portMatch = ports?.match(/:(\d+)->/);
      return { name, state, port: portMatch ? parseInt(portMatch[1], 10) : null };
    });
  } catch {
    return [];
  }
}
