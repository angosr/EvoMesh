/**
 * Health monitoring: registry, auto-restart, brain-dead detection, compliance nudging.
 * Extracted from index.ts to keep it under 500 lines.
 */
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { loadConfig } from "../config/loader.js";
import { isRoleRunning, getContainerPort, getContainerState, startRole, stopRole, containerName, centralContainerName } from "../process/container.js";
import { roleDir } from "../utils/paths.js";
import { ensureCentralAI } from "./routes-admin.js";
import { allocatePort } from "./routes.js";
import type { ServerContext } from "./index.js";

let lastGoodProjects: Record<string, any> = {};
let centralRestartFails = 0;
const prevRunning = new Map<string, boolean>();
const lastRestart = new Map<string, number>();
const lastNudge = new Map<string, number>();
const idleCount = new Map<string, number>();
const lastIdleMtime = new Map<string, number>();
const lastIdleAction = new Map<string, number>();
const roleStartTime = new Map<string, number>();
const RESTART_COOLDOWN = 5 * 60 * 1000;
const NUDGE_COOLDOWN = 5 * 60 * 1000;
const START_GRACE_PERIOD = 3 * 60 * 1000; // 3 min grace after start before nudge/idle

export const statsCache = new Map<string, { mem: string; cpu: string }>();

// --- Tmux command sending (SSOT for host/docker dispatch) ---
const gosuUser = process.env.USER || "user";

/** Send a single message to a role's tmux session and press Enter. */
function sendToRole(sessionName: string, launchMode: string | undefined, message: string): void {
  if (launchMode === "host") {
    execFileSync("tmux", ["send-keys", "-t", sessionName, "-l", message], { stdio: "ignore", timeout: 5000 });
    execFileSync("tmux", ["send-keys", "-t", sessionName, "Enter"], { stdio: "ignore", timeout: 5000 });
  } else {
    const escaped = message.replace(/'/g, "'\\''");
    execFileSync("docker", ["exec", sessionName, "gosu", gosuUser, "bash", "-c",
      `tmux -f /dev/null send-keys -t claude -l '${escaped}' 2>/dev/null; tmux -f /dev/null send-keys -t claude Enter 2>/dev/null`
    ], { stdio: "ignore", timeout: 5000 });
  }
}

/** Send multiple messages with delays. Retries each step up to 2 times on failure. */
function sendToRoleSequence(sessionName: string, launchMode: string | undefined, steps: { message: string; delaySec: number }[]): void {
  let cumulativeDelay = 0;
  for (const step of steps) {
    cumulativeDelay += step.delaySec * 1000;
    const delay = cumulativeDelay;
    const msg = step.message;
    setTimeout(() => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          sendToRole(sessionName, launchMode, msg);
          return;
        } catch (e) {
          if (attempt === 1) console.error(`[sendToRoleSequence] Failed after 2 attempts (${sessionName}):`, e);
        }
      }
    }, delay);
  }
}

// --- Role start tracking: record when each role was started/restarted ---

/** Mark a role as just started. Call this from all start/restart paths. */
export function recordRoleStart(key: string): void {
  const now = Date.now();
  roleStartTime.set(key, now);
  lastRestart.set(key, now);
  // Reset monitoring state so stale data from previous session doesn't trigger actions
  idleCount.set(key, 0);
  lastIdleMtime.delete(key);
  lastIdleAction.delete(key);
  lastNudge.delete(key);
}

/** Check if a role is within its post-start grace period. */
function isInGracePeriod(key: string): boolean {
  const startTime = roleStartTime.get(key);
  if (!startTime) return false;
  return (Date.now() - startTime) < START_GRACE_PERIOD;
}

// --- Desired state persistence: which roles SHOULD be running ---
const DESIRED_STATE_FILE = path.join(os.homedir(), ".evomesh", "running-roles.json");

function loadDesiredState(): Record<string, boolean> {
  try {
    if (fs.existsSync(DESIRED_STATE_FILE)) return JSON.parse(fs.readFileSync(DESIRED_STATE_FILE, "utf-8"));
  } catch (e) {
    console.error("[loadDesiredState] Corrupted or unreadable, returning empty:", e);
  }
  return {};
}

function saveDesiredState(state: Record<string, boolean>): void {
  try {
    const tmpPath = DESIRED_STATE_FILE + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf-8");
    fs.renameSync(tmpPath, DESIRED_STATE_FILE);
  } catch (e) {
    console.error("[saveDesiredState] Failed to persist desired state:", e);
  }
}

export function markRoleRunning(key: string): void {
  const state = loadDesiredState();
  state[key] = true;
  saveDesiredState(state);
}

export function markRoleStopped(key: string): void {
  const state = loadDesiredState();
  delete state[key];
  saveDesiredState(state);
}

/**
 * Start a role and atomically update all state: ttydProcesses, desired state, monitoring.
 * All callsites should use this instead of raw startRole + manual state updates.
 */
export function startRoleManaged(
  ctx: ServerContext, projectRoot: string, projectSlug: string,
  roleName: string, rc: import("../config/schema.js").RoleConfig,
  config: import("../config/schema.js").ProjectConfig, ttydPort: number,
): import("../process/container.js").ContainerRole {
  const key = `${projectSlug}/${roleName}`;
  const result = startRole(projectRoot, roleName, rc, config, ttydPort, { launchMode: rc.launch_mode });
  ctx.ttydProcesses.set(key, { port: ttydPort, roleName, projectSlug });
  markRoleRunning(key);
  recordRoleStart(key);
  return result;
}

/**
 * Stop a role and atomically update all state: desired state, ttydProcesses.
 * Pass `userStopped: true` when user explicitly stops (prevents auto-restart).
 * Pass `keepDesiredState: true` for stop-then-restart flows (config change, restart).
 */
export function stopRoleManaged(
  ctx: ServerContext, projectRoot: string, projectSlug: string,
  roleName: string, opts: { userStopped?: boolean; keepDesiredState?: boolean } = {},
): void {
  const key = `${projectSlug}/${roleName}`;
  stopRole(projectRoot, roleName);
  if (!opts.keepDesiredState) {
    markRoleStopped(key);
    ctx.ttydProcesses.delete(key);
  }
  if (opts.userStopped) {
    const entry = ctx.ttydProcesses.get(key);
    if (entry) { entry.userStopped = true; } else {
      ctx.ttydProcesses.set(key, { port: 0, roleName, projectSlug, userStopped: true });
    }
  }
}

/** On server startup, restart all roles that were running before restart. */
export function restoreDesiredRoles(ctx: ServerContext): void {
  const desired = loadDesiredState();
  for (const [key, shouldRun] of Object.entries(desired)) {
    if (!shouldRun) continue;
    const [slug, roleName] = key.split("/");
    if (!slug || !roleName) continue;
    const project = ctx.getProject(slug);
    if (!project) continue;
    try {
      const config = loadConfig(project.root);
      const rc = config.roles[roleName];
      if (!rc) continue;
      if (isRoleRunning(project.root, roleName)) {
        // Already running — seed prevRunning so crash detection works from first cycle
        prevRunning.set(key, true);
        continue;
      }
      const ttydPort = allocatePort(ctx);
      startRoleManaged(ctx, project.root, slug, roleName, rc, config, ttydPort);
      prevRunning.set(key, true);
      console.log(`[restore] Started ${roleName} in ${project.name} (port ${ttydPort})`);
    } catch (e) { console.error(`[restore] Failed to start ${roleName} in ${slug}:`, e); }
  }
  console.log(`[restore] Desired state: ${JSON.stringify(desired)}, restored roles logged above`);
}

// --- Account health: check if Claude credentials are valid ---
const accountHealthCache = new Map<string, boolean>(); // path → needsLogin

function checkAccountHealth(): void {
  try {
    const homeDir = os.homedir();
    const dirs = fs.readdirSync(homeDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith(".claude"));
    for (const d of dirs) {
      const dir = path.join(homeDir, d.name);
      let needsLogin = true;
      try {
        const creds = JSON.parse(fs.readFileSync(path.join(dir, ".credentials.json"), "utf-8"));
        const token = creds?.claudeAiOauth?.accessToken;
        const expiry = creds?.claudeAiOauth?.expiresAt;
        if (token && (!expiry || new Date(expiry).getTime() > Date.now())) {
          needsLogin = false;
        }
      } catch {
        // .credentials.json missing or malformed — keep needsLogin=true
      }
      accountHealthCache.set(dir, needsLogin);
    }
  } catch (e) { console.error("[checkAccountHealth] Error scanning account dirs:", e); }
}

export function isAccountDown(accountPath: string): boolean {
  return accountHealthCache.get(accountPath) ?? false;
}

export function writeRegistry(ctx: ServerContext, port: number): void {
  try {
    checkAccountHealth(); // Update account health each cycle
    const projects = ctx.getProjects();
    const projectEntries: Record<string, any> = {};
    for (const p of projects) {
      try {
        const config = loadConfig(p.root);
        const roles: Record<string, any> = {};
        for (const [name, rc] of Object.entries(config.roles)) {
          const running = isRoleRunning(p.root, name);
          const cname = containerName(p.slug, name);
          const accountPath = path.join(os.homedir(), config.accounts[rc.account] || ".claude");
          const accountDown = isAccountDown(accountPath);
          roles[name] = { configured: true, running, port: running ? getContainerPort(cname) : null, accountDown: accountDown || undefined };
        }
        projectEntries[p.slug] = { path: p.root, roles };
      } catch (e) {
        console.error(`[writeRegistry] Failed to read config for ${p.slug}:`, e);
        if (lastGoodProjects[p.slug]) projectEntries[p.slug] = lastGoodProjects[p.slug];
      }
    }
    lastGoodProjects = { ...projectEntries };

    // Docker stats cache
    try {
      const allStats = execFileSync("docker", [
        "stats", "--no-stream", "--format", "{{.Name}}|{{.MemUsage}}|{{.CPUPerc}}",
      ], { encoding: "utf-8", timeout: 10000 }).trim();
      for (const line of allStats.split("\n")) {
        const [cname, mem, cpu] = line.split("|");
        if (cname && mem) statsCache.set(cname, { mem: mem.split("/")[0]?.trim() || "", cpu: cpu?.trim() || "" });
      }
    } catch {
      // docker stats can fail transiently — non-critical
    }

    // Central AI auto-recovery
    const centralName = centralContainerName();
    const centralRunning = getContainerState(centralName) === "running";
    const centralPort = centralRunning ? getContainerPort(centralName) : null;
    let centralError = false;
    if (!centralRunning) {
      centralRestartFails++;
      if (centralRestartFails <= 3) {
        console.log(`[central-ai] Not running, attempting restart (attempt ${centralRestartFails}/3)...`);
        try { ensureCentralAI(ctx); } catch (e) { console.error("[central-ai] Auto-restart failed:", e); }
      } else {
        centralError = true;
      }
    } else {
      centralRestartFails = 0;
    }

    const registry = {
      timestamp: new Date().toISOString(),
      staleAfterMs: 30000,
      server: { port },
      projects: projectEntries,
      central: { running: centralRunning, port: centralPort, error: centralError || undefined },
    };
    const registryPath = path.join(os.homedir(), ".evomesh", "registry.json");
    const tmpPath = registryPath + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(registry, null, 2), "utf-8");
    fs.renameSync(tmpPath, registryPath);
  } catch (e) {
    console.error("Failed to write registry:", e);
  }
}

/**
 * Auto-restart crashed/brain-dead roles.
 *
 * SINGLE SOURCE OF TRUTH: running-roles.json (desired state)
 * - Role in running-roles.json + not running → restart (crashed)
 * - Role NOT in running-roles.json + not running → leave stopped (user-stopped)
 * - The in-memory userStopped flag is NOT checked — only running-roles.json matters.
 */
export function autoRestartCrashed(ctx: ServerContext): void {
  try {
    const now = Date.now();
    const desired = loadDesiredState();
    const projects = ctx.getProjects();
    for (const p of projects) {
      let config;
      try { config = loadConfig(p.root); } catch { continue; }
      for (const [name, rc] of Object.entries(config.roles)) {
        const key = `${p.slug}/${name}`;
        const running = isRoleRunning(p.root, name);
        const shouldRun = key in desired && desired[key];

        // Initialize prevRunning from actual state on first encounter
        if (!prevRunning.has(key)) {
          prevRunning.set(key, running);
          continue; // Skip action on first observation — need two data points
        }
        const wasRunning = prevRunning.get(key)!;
        prevRunning.set(key, running);

        // Crashed: was running, now stopped, should be running
        if (wasRunning && !running && shouldRun) {
          const lastTime = lastRestart.get(key) || 0;
          if (now - lastTime < RESTART_COOLDOWN) continue;
          console.log(`[auto-restart] ${name} crashed in ${p.name}, restarting...`);
          try {
            const ttydPort = allocatePort(ctx);
            startRoleManaged(ctx, p.root, p.slug, name, rc, config, ttydPort);
            prevRunning.set(key, true);
          } catch (e) { console.error(`[auto-restart] Failed to restart ${name}:`, e); }
        }

        // Brain-dead: running but no activity for extended period
        if (running && shouldRun && !isInGracePeriod(key)) {
          try {
            const stmPath = path.join(roleDir(p.root, name), "memory", "short-term.md");
            const stmStat = fs.statSync(stmPath);
            const stmAgeMs = now - stmStat.mtimeMs;
            const intervalMin = parseInt(rc.loop_interval) || 10;
            const bdThreshold = intervalMin * 10 * 60 * 1000;
            const lastTime = lastRestart.get(key) || 0;
            if (stmAgeMs > bdThreshold && (now - lastTime) > 10 * 60 * 1000) {
              // Git log fallback: if git fails, assume role is alive (safe default)
              let hasRecentCommit = true; // default to true = safe, don't kill
              try {
                const gitLog = execFileSync("git", ["log", "--oneline", `--since=${intervalMin * 10} minutes ago`, `--grep=${name}`], { cwd: p.root, encoding: "utf-8", timeout: 5000 });
                hasRecentCommit = gitLog.trim().length > 0;
              } catch (e) {
                console.error(`[brain-dead] git log failed for ${name}, assuming alive:`, e);
              }
              if (!hasRecentCommit) {
                console.log(`[brain-dead] ${name} memory ${Math.round(stmAgeMs / 60000)}min stale, no recent commits — restarting`);
                stopRoleManaged(ctx, p.root, p.slug, name, { keepDesiredState: true });
                recordRoleStart(key); // cooldown + grace period for the restart cycle
              }
            }
          } catch (e) { console.error(`[brain-dead] Error checking ${name}:`, e); }

          // Context cleanup: role requests restart via heartbeat.json content
          try {
            const hbPath = path.join(roleDir(p.root, name), "heartbeat.json");
            const hbContent = JSON.parse(fs.readFileSync(hbPath, "utf-8"));
            if (hbContent.request === "restart") {
              const lastTime = lastRestart.get(key) || 0;
              if (now - lastTime > RESTART_COOLDOWN) {
                console.log(`[context-cleanup] ${name} requested restart (reason: ${hbContent.reason || "unknown"})`);
                fs.writeFileSync(hbPath, JSON.stringify({ ts: now, restarted_at: new Date().toISOString() }));
                stopRoleManaged(ctx, p.root, p.slug, name, { keepDesiredState: true });
                recordRoleStart(key);
              }
            }
          } catch {
            // heartbeat.json missing or no restart request — normal
          }
        }
      }
    }
  } catch (e) { console.error("[autoRestartCrashed] Error:", e); }
}

export function verifyLoopCompliance(ctx: ServerContext): void {
  try {
    const now = Date.now();
    const projects = ctx.getProjects();
    for (const p of projects) {
      let config;
      try { config = loadConfig(p.root); } catch { continue; }
      for (const [name, rc] of Object.entries(config.roles)) {
        if (!isRoleRunning(p.root, name)) continue;
        const key = `${p.slug}/${name}`;

        // Skip roles in grace period — they haven't had time to complete first loop
        if (isInGracePeriod(key)) continue;

        const lastNudgeTime = lastNudge.get(key) || 0;
        if (now - lastNudgeTime < NUDGE_COOLDOWN) continue;

        const intervalMin = parseInt(rc.loop_interval) || 10;
        const threshold = Math.max(intervalMin * 1.5, 10);
        const stmPath = path.join(roleDir(p.root, name), "memory", "short-term.md");
        try {
          const stat = fs.statSync(stmPath);
          const ageMin = (now - stat.mtimeMs) / 60000;
          const entry = ctx.ttydProcesses.get(key);
          if (!entry) continue;
          if (ageMin > threshold) {
            const sessionName = containerName(p.slug, name);
            const nudgeMsg = "[SYSTEM] Write memory/short-term.md and heartbeat.json before continuing.";
            try {
              sendToRole(sessionName, rc.launch_mode, nudgeMsg);
              lastNudge.set(key, now);
              console.log(`[verify] Nudged ${name} — memory ${Math.round(ageMin)}min stale`);
            } catch (e) { console.error(`[verify] Failed to nudge ${name}:`, e); }
          }
        } catch {
          // short-term.md doesn't exist yet — role hasn't completed first loop
        }
      }
    }
  } catch (e) { console.error("[verifyLoopCompliance] Error:", e); }
}

/** Check if a role has unprocessed inbox messages. */
function hasUnprocessedInbox(root: string, name: string): boolean {
  try {
    const inboxDir = path.join(roleDir(root, name), "inbox");
    const entries = fs.readdirSync(inboxDir, { withFileTypes: true });
    return entries.some(e => e.isFile() && e.name.endsWith(".md"));
  } catch {
    return false;
  }
}

/**
 * Idle-triggered context cleanup.
 * Detects consecutive idle loops via short-term.md content + mtime tracking.
 * - Non-lead: /clear + /loop (fresh context, process stays running)
 * - Lead: /compact (compress context, keep session)
 */
export function cleanupIdleRoles(ctx: ServerContext): void {
  try {
    const now = Date.now();
    const projects = ctx.getProjects();
    for (const p of projects) {
      let config;
      try { config = loadConfig(p.root); } catch { continue; }
      for (const [name, rc] of Object.entries(config.roles)) {
        if (!isRoleRunning(p.root, name)) continue;
        const key = `${p.slug}/${name}`;

        // Skip roles in grace period
        if (isInGracePeriod(key)) continue;

        // Cooldown check (reuse RESTART_COOLDOWN = 5min)
        const lastAction = lastIdleAction.get(key) || 0;
        if (now - lastAction < RESTART_COOLDOWN) continue;

        const stmPath = path.join(roleDir(p.root, name), "memory", "short-term.md");
        try {
          const stat = fs.statSync(stmPath);
          const currentMtime = stat.mtimeMs;
          const prevMtime = lastIdleMtime.get(key) || 0;

          // Only check when mtime changes (new loop output written)
          if (currentMtime === prevMtime) continue;
          lastIdleMtime.set(key, currentMtime);

          // Read content and check for idle — match only at start of a line
          const content = fs.readFileSync(stmPath, "utf-8");
          if (/^No tasks,?\s*idle/im.test(content)) {
            idleCount.set(key, (idleCount.get(key) || 0) + 1);
          } else {
            idleCount.set(key, 0);
            continue;
          }

          if ((idleCount.get(key) || 0) < 2) continue;

          // Don't cleanup if there are pending inbox messages — role will pick them up next loop
          if (hasUnprocessedInbox(p.root, name)) {
            console.log(`[idle-cleanup] ${name} is idle but has unprocessed inbox — skipping cleanup`);
            idleCount.set(key, 0);
            continue;
          }

          // Threshold reached — take action
          const sessionName = containerName(p.slug, name);

          if (rc.type === "lead") {
            // Lead: compact only — cron persists through /compact
            try {
              sendToRole(sessionName, rc.launch_mode, "/compact");
              console.log(`[idle-cleanup] Sent /compact to lead ${name}`);
            } catch (e) { console.error(`[idle-cleanup] Failed to send /compact to ${name}:`, e); }
          } else {
            // Worker: /clear wipes cron, must re-send /loop
            const roleRootRel = `.evomesh/roles/${name}`;
            const loopInterval = rc.loop_interval || "10m";
            const loopCmd = `/loop ${loopInterval} You are the ${name} role. FIRST: cat and read ${roleRootRel}/ROLE.md completely. Then follow CLAUDE.md loop flow. Working directory: ${roleRootRel}/`;
            try {
              sendToRole(sessionName, rc.launch_mode, "/clear");
              sendToRoleSequence(sessionName, rc.launch_mode, [
                { message: loopCmd, delaySec: 3 },
              ]);
              console.log(`[idle-cleanup] Sent /clear + /loop to worker ${name}`);
            } catch (e) { console.error(`[idle-cleanup] Failed to send /clear + /loop to ${name}:`, e); }
          }

          // Reset counter and record action time
          idleCount.set(key, 0);
          lastIdleAction.set(key, now);
        } catch (e) { console.error(`[idle-cleanup] Error checking ${name}:`, e); }
      }
    }
  } catch (e) { console.error("[cleanupIdleRoles] Error:", e); }
}
