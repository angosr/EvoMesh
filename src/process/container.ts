import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { expandHome } from "../utils/paths.js";
import { ensureDir } from "../utils/fs.js";
import { slugify } from "../workspace/config.js";
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

function projectSlugFromRoot(root: string): string {
  return slugify(path.basename(root));
}

/**
 * Ensure the per-role config directory exists with correct credentials.
 */
function ensureRoleConfig(
  projectSlug: string,
  roleName: string,
  accountPath: string,
  mcpServers?: Record<string, { command: string; args: string[] }>,
): string {
  const configDir = roleConfigDir(projectSlug, roleName);
  ensureDir(configDir);

  // Copy essential files from account directory
  // These are needed for Claude Code to recognize this as a valid config
  const filesToCopy = [
    ".credentials.json",  // OAuth tokens
    ".claude.json",       // User settings/state
    "settings.json",      // Claude Code settings
  ];

  for (const file of filesToCopy) {
    const src = path.join(accountPath, file);
    const dst = path.join(configDir, file);
    if (fs.existsSync(src)) {
      // Always update credentials; others only if missing
      if (file === ".credentials.json" || !fs.existsSync(dst)) {
        fs.copyFileSync(src, dst);
      }
    }
  }

  // Ensure subdirectories exist
  for (const dir of ["sessions", "projects"]) {
    ensureDir(path.join(configDir, dir));
  }

  // Merge MCP server config into settings.json
  if (mcpServers && Object.keys(mcpServers).length > 0) {
    const settingsPath = path.join(configDir, "settings.json");
    let settings: Record<string, any> = {};
    try { settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8")); } catch {}
    settings.mcpServers = { ...settings.mcpServers, ...mcpServers };
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
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
 * Get container/session state. Supports both Docker containers and host tmux sessions.
 */
export function getContainerState(name: string): "running" | "stopped" | "not-found" {
  // First try tmux (host mode)
  try {
    execFileSync("tmux", ["has-session", "-t", name], { stdio: "ignore" });
    return "running"; // tmux session exists
  } catch {}
  // Then try docker
  try {
    const out = execFileSync("docker", ["inspect", "--format", "{{.State.Running}}", name], {
      encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"],
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
    ], { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    return parseInt(out, 10) || null;
  } catch {
    return null;
  }
}

/**
 * Start a role in host tmux mode (no Docker).
 */
function startRoleHost(
  root: string,
  roleName: string,
  roleConfig: RoleConfig,
  config: ProjectConfig,
  ttydPort: number,
): ContainerRole {
  const projectSlug = projectSlugFromRoot(root);
  const sessionName = `evomesh-${projectSlug}-${roleName}`;
  const accountPath = expandHome(config.accounts[roleConfig.account] || "~/.claude");

  // Already running?
  if (getContainerState(sessionName) === "running") {
    return { role: roleName, containerName: sessionName, ttydPort };
  }

  // Session ID for resume
  const roleRoot = path.join(root, ".evomesh", "roles", roleName);
  const sessionIdFile = path.join(roleRoot, ".session-id");
  let claudeArgs = "--dangerously-skip-permissions";
  if (fs.existsSync(sessionIdFile)) {
    const sid = fs.readFileSync(sessionIdFile, "utf-8").trim();
    if (sid) claudeArgs = `--resume ${sid} ${claudeArgs}`;
    else claudeArgs = `--name ${roleName} ${claudeArgs}`;
  } else {
    claudeArgs = `--name ${roleName} ${claudeArgs}`;
  }

  // Start tmux session with claude
  const claudeCmd = `CLAUDE_CONFIG_DIR=${accountPath} claude ${claudeArgs}; exec bash`;
  execFileSync("tmux", [
    "-f", "/dev/null", "new-session", "-d", "-s", sessionName, "-x", "120", "-y", "40", claudeCmd,
  ], { cwd: path.resolve(root), stdio: "ignore" });

  // Start ttyd pointing at tmux session
  const ttydCmd = `ttyd --writable -t fontSize=14 -t scrollback=10000 --port ${ttydPort} -- tmux attach-session -t ${sessionName}`;
  execFileSync("bash", ["-c", `nohup ${ttydCmd} > /tmp/ttyd-${sessionName}.log 2>&1 &`], { stdio: "ignore" });

  // Send /loop command after delay
  const loopInterval = roleConfig.loop_interval || "10m";
  const roleRootRel = `.evomesh/roles/${roleName}`;
  const loopCmd = `/loop ${loopInterval} You are the ${roleName} role. FIRST: cat and read ${roleRootRel}/ROLE.md completely. Then follow CLAUDE.md loop flow. Working directory: ${roleRootRel}/`;

  // Background: wait for claude to be ready, then send /loop
  execFileSync("bash", ["-c", `(
    sleep 15
    for i in $(seq 1 60); do
      tmux capture-pane -t ${sessionName} -p 2>/dev/null | grep -q '❯' && break
      sleep 1
    done
    sleep 2
    tmux send-keys -t ${sessionName} -l '${loopCmd.replace(/'/g, "'\\''")}'
    sleep 0.5
    tmux send-keys -t ${sessionName} Enter
  ) &`], { stdio: "ignore" });

  return { role: roleName, containerName: sessionName, ttydPort };
}

/**
 * Start a role. Dispatches to Docker or host tmux based on launch_mode.
 */
export function startRole(
  root: string,
  roleName: string,
  roleConfig: RoleConfig,
  config: ProjectConfig,
  ttydPort: number,
  opts: { centralAI?: boolean; containerNameOverride?: string; projectRoots?: string[]; launchMode?: "docker" | "host" } = {}
): ContainerRole {
  if (opts.launchMode === "host") {
    return startRoleHost(root, roleName, roleConfig, config, ttydPort);
  }
  const projectSlug = projectSlugFromRoot(root);
  const name = opts.containerNameOverride || containerName(projectSlug, roleName);
  const accountPath = expandHome(config.accounts[roleConfig.account] || "~/.claude");

  // If container is already running, just return its info
  if (getContainerState(name) === "running") {
    const port = getContainerPort(name);
    if (port) return { role: roleName, containerName: name, ttydPort: port };
  }

  // Ensure role config directory with credentials + MCP config
  const configDir = ensureRoleConfig(projectSlug, roleName, accountPath, roleConfig.mcp);

  // Remove stopped/dead container before creating new one
  try { execFileSync("docker", ["rm", "-f", name], { stdio: ["pipe", "pipe", "ignore"] }); } catch {}

  const homeDir = os.homedir();

  // Build docker args — mount to same paths as host for full compatibility
  const args = [
    "run", "-d",
    "--name", name,
    "--hostname", roleName,
    "--restart", "unless-stopped",
  ];
  if (opts.centralAI) {
    args.push("--network", "host");
    args.push("-e", `TTYD_PORT=${ttydPort}`);
  } else {
    args.push("-p", `127.0.0.1:${ttydPort}:7681`);
  }

  if (opts.centralAI) {
    // Central AI: scoped mounts — .evomesh config + each project dir
    args.push("-v", `${path.join(homeDir, ".evomesh")}:${path.join(homeDir, ".evomesh")}:rw`);
    args.push("-v", `${accountPath}:${accountPath}:rw`);
    args.push("-v", `${path.join(homeDir, ".claude.json")}:${path.join(homeDir, ".claude.json")}:rw`);
    // Mount each project directory for file-based access
    if (opts.projectRoots) {
      for (const projRoot of opts.projectRoots) {
        args.push("-v", `${projRoot}:${projRoot}:rw`);
      }
    }
  } else {
    // Normal role: mount project dir + claude config only
    args.push("-v", `${path.resolve(root)}:${path.resolve(root)}:rw`);
    args.push("-v", `${accountPath}:${accountPath}:rw`);
    args.push("-v", `${path.join(homeDir, ".claude.json")}:${path.join(homeDir, ".claude.json")}:rw`);
  }

  // Git config (RO)
  const gitconfig = path.join(homeDir, ".gitconfig");
  if (fs.existsSync(gitconfig)) {
    args.push("-v", `${gitconfig}:${gitconfig}:ro`);
  }

  // SSH: mount only known_hosts (never expose private keys)
  const knownHosts = path.join(homeDir, ".ssh", "known_hosts");
  if (fs.existsSync(knownHosts)) {
    args.push("-v", `${knownHosts}:${path.join(homeDir, ".ssh", "known_hosts")}:ro`);
  }
  // SSH agent forwarding for git push (keys stay on host)
  if (process.env.SSH_AUTH_SOCK) {
    args.push("-v", `${process.env.SSH_AUTH_SOCK}:/tmp/ssh-agent.sock`);
    args.push("-e", "SSH_AUTH_SOCK=/tmp/ssh-agent.sock");
  }

  // Environment — preserve host paths
  args.push("-e", `HOST_UID=${process.getuid?.() || 1000}`);
  args.push("-e", `HOST_GID=${process.getgid?.() || 1000}`);
  args.push("-e", `HOST_USER=${process.env.USER || "user"}`);
  args.push("-e", `HOST_HOME=${homeDir}`);
  args.push("-e", `HOME=${homeDir}`);
  args.push("-e", `CLAUDE_CONFIG_DIR=${accountPath}`);
  args.push("-e", `ROLE_NAME=${roleName}`);
  args.push("-e", `LOOP_INTERVAL=${roleConfig.loop_interval || "10m"}`);

  const roleRoot = `.evomesh/roles/${roleName}`;
  args.push("-e", `LOOP_PROMPT=你是 ${roleName} 角色。执行 ${roleRoot}/ROLE.md 工作目录: ${roleRoot}/`);

  // Working directory — same as host
  args.push("-w", path.resolve(root));

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
 * Stop a role. Handles both Docker containers and host tmux sessions.
 */
export function stopRole(root: string, roleName: string): boolean {
  const name = containerName(projectSlugFromRoot(root), roleName);
  // Try tmux first (host mode)
  try {
    execFileSync("tmux", ["has-session", "-t", name], { stdio: "ignore" });
    // It's a tmux session — kill it
    execFileSync("tmux", ["kill-session", "-t", name], { stdio: "ignore" });
    // Kill associated ttyd process
    try {
      execFileSync("bash", ["-c", `pkill -f "ttyd.*${name}" 2>/dev/null`], { stdio: "ignore" });
    } catch {}
    return true;
  } catch {}
  // Try docker
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
  const name = containerName(projectSlugFromRoot(root), roleName);
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
  return getContainerState(containerName(projectSlugFromRoot(root), roleName)) === "running";
}

/**
 * Get container logs.
 */
export function getRoleLogs(root: string, roleName: string, tail: number = 500): string {
  const name = containerName(projectSlugFromRoot(root), roleName);
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
 * Uses env var to pass input safely — avoids shell injection.
 */
export function sendInput(root: string, roleName: string, input: string): boolean {
  const name = containerName(projectSlugFromRoot(root), roleName);
  try {
    execFileSync("docker", [
      "exec", "-e", `EVOMESH_INPUT=${input}`,
      name, "sh", "-c", 'printf "%s\\n" "$EVOMESH_INPUT" > /proc/1/fd/0',
    ], { stdio: "ignore" });
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
  const projectSlug = projectSlugFromRoot(root);
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
