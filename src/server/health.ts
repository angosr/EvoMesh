/**
 * Health monitoring: registry, auto-restart crashed containers, idle detection.
 * Monitor NEVER injects commands into running AI sessions except for explicit idle cleanup.
 */
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync, execFile } from "node:child_process";
import { loadConfig } from "../config/loader.js";
import { isRoleRunning, getContainerPort, getContainerState, startRole, stopRole, containerName, centralContainerName } from "../process/container.js";
import { roleDir } from "../utils/paths.js";
import { ensureCentralAI, isCentralEnabled } from "./routes-admin.js";
import { allocatePort } from "./routes.js";
import type { ServerContext } from "./index.js";

let lastGoodProjects: Record<string, any> = {};
let centralRestartFails = 0;
const prevRunning = new Map<string, boolean>();
const lastRestart = new Map<string, number>();
const idleCount = new Map<string, number>();
const lastIdleMtime = new Map<string, number>();
const lastIdleAction = new Map<string, number>();
const roleStartTime = new Map<string, number>();
const RESTART_COOLDOWN = 5 * 60 * 1000;
const MAX_IDLE_RESETS = 2;
const serverStartTime = Date.now();
const SERVER_WARMUP = 5 * 60 * 1000;
const START_GRACE_PERIOD = 3 * 60 * 1000;

// --- Persistent monitor state (survives server/tsx-watch restarts) ---
const MONITOR_STATE_FILE = path.join(os.homedir(), ".evomesh", "monitor-state.json");
interface MonitorRoleState {
  restartCount: number;   // consecutive restart attempts without new STM output
  lastRestartTs: number;  // timestamp of last restart
  lastStmMtime: number;   // STM mtime at last check — detect actual new output
  suspended: boolean;     // circuit breaker: stop all actions on this role
}
let monitorState: Record<string, MonitorRoleState> = {};

function loadMonitorState(): void {
  try {
    if (fs.existsSync(MONITOR_STATE_FILE)) {
      monitorState = JSON.parse(fs.readFileSync(MONITOR_STATE_FILE, "utf-8"));
    }
  } catch (e) { console.error("[monitor-state] Failed to load:", e); monitorState = {}; }
}

function saveMonitorState(): void {
  try {
    const tmpPath = MONITOR_STATE_FILE + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(monitorState, null, 2), "utf-8");
    fs.renameSync(tmpPath, MONITOR_STATE_FILE);
  } catch (e) { console.error("[monitor-state] Failed to save:", e); }
}

function getMonitorRole(key: string): MonitorRoleState {
  if (!monitorState[key]) monitorState[key] = { restartCount: 0, lastRestartTs: 0, lastStmMtime: 0, suspended: false };
  return monitorState[key];
}

/** Record a monitor-initiated restart. Increments circuit breaker counter. */
function recordMonitorRestart(key: string): void {
  const ms = getMonitorRole(key);
  ms.restartCount++;
  ms.lastRestartTs = Date.now();
  if (ms.restartCount >= 3) {
    ms.suspended = true;
    console.log(`[monitor] CIRCUIT BREAKER: ${key} restarted ${ms.restartCount}x without new output — all monitor actions suspended`);
  }
  saveMonitorState();
}

/** Check if role produced new STM output since last monitor action. Resets circuit breaker if so. */
function checkAndResetCircuitBreaker(key: string, currentStmMtime: number): void {
  const ms = getMonitorRole(key);
  if (ms.lastStmMtime > 0 && currentStmMtime > ms.lastStmMtime) {
    // Role produced new output — reset circuit breaker
    if (ms.restartCount > 0 || ms.suspended) {
      console.log(`[monitor] ${key} produced new output — circuit breaker reset`);
    }
    ms.restartCount = 0;
    ms.suspended = false;
    saveMonitorState();
  }
  ms.lastStmMtime = currentStmMtime;
}

/** Check if monitor actions are suspended for this role. */
function isMonitorSuspended(key: string): boolean {
  return getMonitorRole(key).suspended;
}

// Load persistent state on startup
loadMonitorState();

export const statsCache = new Map<string, { mem: string; cpu: string }>();

/** Broadcast a monitor event to the feed panel. */
function notifyFeed(ctx: ServerContext, role: string, project: string, text: string): void {
  const broadcast = (ctx as any)._broadcastFeed as ((msg: Record<string, unknown>) => void) | undefined;
  if (broadcast) broadcast({ type: "role", role: `${role} [monitor]`, project, text, time: new Date().toISOString() });
}

// parseIntervalMinutes removed — was only used by brain-dead detection

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
  idleCount.set(key, 0);
  lastIdleMtime.delete(key);
  lastIdleAction.delete(key);
  // Do NOT reset persistent monitorState — circuit breaker must persist
}

/** Check if a role is within its post-start grace period.
 * Uses both in-memory state AND container/process uptime for crash-safety. */
function isInGracePeriod(key: string): boolean {
  const startTime = roleStartTime.get(key);
  if (startTime) {
    return (Date.now() - startTime) < START_GRACE_PERIOD;
  }
  // No in-memory record (server restarted). Check actual container/process uptime.
  // If the container started recently, it's in grace period.
  const [slug, roleName] = key.split("/");
  if (!slug || !roleName) return false;
  try {
    const cname = containerName(slug, roleName);
    // Try docker first
    const startedAt = execFileSync("docker", ["inspect", "--format", "{{.State.StartedAt}}", cname],
      { encoding: "utf-8", timeout: 3000 }).trim();
    if (startedAt) {
      const containerAge = Date.now() - new Date(startedAt).getTime();
      roleStartTime.set(key, Date.now() - containerAge); // backfill for future checks
      return containerAge < START_GRACE_PERIOD;
    }
  } catch {
    // Not a docker container — check tmux session age via /proc
    try {
      const pids = execFileSync("pgrep", ["-f", `tmux.*${key.split("/").pop()}`],
        { encoding: "utf-8", timeout: 3000 }).trim();
      if (pids) {
        const pid = pids.split("\n")[0];
        const stat = fs.statSync(`/proc/${pid}`);
        const procAge = Date.now() - stat.ctimeMs;
        roleStartTime.set(key, Date.now() - procAge);
        return procAge < START_GRACE_PERIOD;
      }
    } catch { /* process not found */ }
  }
  // Can't determine uptime — grant grace period to be safe
  roleStartTime.set(key, Date.now());
  return true;
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
  roleName: string, opts: { userStopped?: boolean; keepDesiredState?: boolean; reason?: string } = {},
): void {
  const key = `${projectSlug}/${roleName}`;
  console.log(`[lifecycle] ${roleName} stopped by ${opts.reason || "unknown"}`);
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
    } catch (e) {
      console.error(`[restore] Failed to start ${roleName} in ${slug}:`, e);
      console.error(`[restore]   project: ${project.root}, nextPort: ${(ctx as any)._nextPort || "?"}`);
    }
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
  return accountHealthCache.get(accountPath) ?? true; // unchecked = assume needs login
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

    // Docker stats cache — async to avoid blocking event loop (WebSocket proxy latency)
    execFile("docker", [
      "stats", "--no-stream", "--format", "{{.Name}}|{{.MemUsage}}|{{.CPUPerc}}",
    ], { encoding: "utf-8", timeout: 10000 }, (err, stdout) => {
      if (err || !stdout) return; // docker stats can fail transiently — non-critical
      for (const line of stdout.trim().split("\n")) {
        const [cname, mem, cpu] = line.split("|");
        if (cname && mem) statsCache.set(cname, { mem: mem.split("/")[0]?.trim() || "", cpu: cpu?.trim() || "" });
      }
    });

    // Central AI auto-recovery (only if enabled)
    const centralName = centralContainerName();
    const centralEnabled = isCentralEnabled();
    const centralRunning = centralEnabled ? getContainerState(centralName) === "running" : false;
    const centralPort = centralRunning ? getContainerPort(centralName) : null;
    let centralError = false;
    if (centralEnabled && !centralRunning) {
      centralRestartFails++;
      if (centralRestartFails > 3 && centralRestartFails % 40 === 0) {
        centralRestartFails = 1;
      }
      if (centralRestartFails <= 3) {
        console.log(`[central-ai] Not running, attempting restart (attempt ${centralRestartFails}/3)...`);
        try { ensureCentralAI(ctx); } catch (e) { console.error("[central-ai] Auto-restart failed:", e); }
      } else {
        centralError = true;
      }
    } else if (centralRunning) {
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
          notifyFeed(ctx, name, p.slug, `crashed, auto-restarting...`);
          try {
            const ttydPort = allocatePort(ctx);
            startRoleManaged(ctx, p.root, p.slug, name, rc, config, ttydPort);
            prevRunning.set(key, true);
          } catch (e) { console.error(`[auto-restart] Failed to restart ${name}:`, e); }
        }

        // Vanished: never seen running but desired — container disappeared between cycles
        if (!running && shouldRun && !wasRunning) {
          const lastTime = lastRestart.get(key) || 0;
          if (now - lastTime < RESTART_COOLDOWN) continue;
          if (isInGracePeriod(key)) continue;
          console.log(`[auto-restart] ${name} vanished in ${p.name} (desired but never seen running), restarting...`);
          notifyFeed(ctx, name, p.slug, `vanished, auto-restarting...`);
          try {
            const ttydPort = allocatePort(ctx);
            startRoleManaged(ctx, p.root, p.slug, name, rc, config, ttydPort);
            prevRunning.set(key, true);
          } catch (e) { console.error(`[auto-restart] Failed to restart vanished ${name}:`, e); }
        }

        // Brain-dead detection REMOVED — too many false positives.
        // Roles doing long tasks (training, analysis) were killed repeatedly.
        // Context-cleanup via heartbeat.json REMOVED — stopping containers
        // mid-work causes state loss. Users can restart manually if needed.
      }
    }
  } catch (e) { console.error("[autoRestartCrashed] Error:", e); }
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
 * Detect if a role is EXPLICITLY idle — the role itself declared "No tasks, idle".
 *
 * IMPORTANT: This ONLY matches explicit idle declarations. A role with old STM
 * that hasn't written recently is NOT considered idle — it may be busy with
 * a long-running task (training, complex analysis, etc). Only the role itself
 * knows whether it's idle. We trust the role's self-report, not STM staleness.
 */
function isExplicitlyIdle(content: string): boolean {
  return /^No tasks,?\s*idle/im.test(content);
}

/**
 * Idle-triggered context cleanup.
 * Detects consecutive idle loops via short-term.md content + mtime tracking.
 * - Non-lead: /clear + /loop (fresh context, process stays running)
 * - Lead: /compact (compress context, keep session)
 */
export function cleanupIdleRoles(ctx: ServerContext): void {
  if (Date.now() - serverStartTime < SERVER_WARMUP) return; // no cleanup during warmup
  try {
    const now = Date.now();
    const projects = ctx.getProjects();
    for (const p of projects) {
      let config;
      try { config = loadConfig(p.root); } catch { continue; }
      for (const [name, rc] of Object.entries(config.roles)) {
        if (!isRoleRunning(p.root, name)) continue;
        const key = `${p.slug}/${name}`;

        // Skip roles in grace period or suspended by circuit breaker
        if (isInGracePeriod(key)) continue;
        if (isMonitorSuspended(key)) continue;

        // Cooldown check (reuse RESTART_COOLDOWN = 5min)
        const lastAction = lastIdleAction.get(key) || 0;
        if (now - lastAction < RESTART_COOLDOWN) continue;

        const stmPath = path.join(roleDir(p.root, name), "memory", "short-term.md");
        try {
          const stat = fs.statSync(stmPath);
          const currentMtime = stat.mtimeMs;
          const prevMtime = lastIdleMtime.get(key) || 0;

          // Check for new output → reset circuit breaker if role produced work
          checkAndResetCircuitBreaker(key, currentMtime);

          // SAFETY: Only act on EXPLICIT idle declarations from the role itself.
          // A stale STM does NOT mean idle — role may be busy with a long task.
          // Only the role knows if it's idle. We require the file to be freshly
          // written (mtime changed) with "No tasks, idle" content.
          if (currentMtime === prevMtime) continue; // no new output — skip entirely
          lastIdleMtime.set(key, currentMtime);

          const content = fs.readFileSync(stmPath, "utf-8");
          if (isExplicitlyIdle(content)) {
            idleCount.set(key, (idleCount.get(key) || 0) + 1);
          } else {
            idleCount.set(key, 0);
            continue;
          }

          // Require 3 consecutive explicit idle writes before acting
          if ((idleCount.get(key) || 0) < 3) continue;

          // Don't cleanup if inbox has pending messages
          if (hasUnprocessedInbox(p.root, name)) {
            console.log(`[idle-cleanup] ${name} idle but has unprocessed inbox — skipping`);
            idleCount.set(key, 0);
            continue;
          }

          // Stop resetting if we've already tried multiple times — role is genuinely idle
          const resets = getMonitorRole(key).restartCount;
          if (resets >= MAX_IDLE_RESETS) {
            // Already reset multiple times, still idle — accept it, don't loop forever
            idleCount.set(key, 0);
            continue;
          }

          // Threshold reached — take action based on idle_policy
          // Default: ignore. User must explicitly set policy to compact or reset.
          const policy = (rc as any).idle_policy || "ignore";
          const sessionName = containerName(p.slug, name);

          if (policy === "compact") {
            try {
              sendToRole(sessionName, rc.launch_mode, "/compact");
              console.log(`[idle-cleanup] Sent /compact to ${name}`);
              notifyFeed(ctx, name, p.slug, `idle (3x) → /compact`);
            } catch (e) { console.error(`[idle-cleanup] Failed to send /compact to ${name}:`, e); }
          } else if (policy === "reset") {
            // Reset = /clear + /loop (context reset, NOT container restart)
            const roleRootRel = `.evomesh/roles/${name}`;
            const loopInterval = rc.loop_interval || "10m";
            const loopCmd = `/loop ${loopInterval} You are the ${name} role. FIRST: cat and read ${roleRootRel}/ROLE.md completely. Then follow CLAUDE.md loop flow. Working directory: ${roleRootRel}/`;
            try {
              sendToRoleSequence(sessionName, rc.launch_mode, [
                { message: "/clear", delaySec: 0 },
                { message: loopCmd, delaySec: 8 },
              ]);
              console.log(`[idle-cleanup] Sent /clear + /loop to ${name}`);
              notifyFeed(ctx, name, p.slug, `idle (3x) → /clear + /loop`);
            } catch (e) { console.error(`[idle-cleanup] Failed to send /clear + /loop to ${name}:`, e); }
          } else {
            // "ignore" (default) — just notify, take no action
            notifyFeed(ctx, name, p.slug, `idle (3x declared)`);
            idleCount.set(key, 0);
            continue;
          }

          idleCount.set(key, 0);
          lastIdleAction.set(key, now);
          recordMonitorRestart(key);
        } catch (e) { console.error(`[idle-cleanup] Error checking ${name}:`, e); }
      }
    }
  } catch (e) { console.error("[cleanupIdleRoles] Error:", e); }
}
