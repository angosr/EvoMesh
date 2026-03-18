/**
 * Health monitoring: registry, auto-restart, brain-dead detection, compliance nudging.
 * Extracted from index.ts to keep it under 500 lines.
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
const lastNudge = new Map<string, number>();
const idleCount = new Map<string, number>();
const lastIdleMtime = new Map<string, number>();
const lastIdleAction = new Map<string, number>();
const idleResetCount = new Map<string, number>(); // track how many times we've reset an idle role
const lastIdleContent = new Map<string, string>(); // detect stuck roles (same content across loops)
const roleStartTime = new Map<string, number>();
const RESTART_COOLDOWN = 5 * 60 * 1000;
const NUDGE_COOLDOWN = 5 * 60 * 1000;
const MAX_IDLE_RESETS = 2; // stop resetting after 2 attempts — role is genuinely idle
const serverStartTime = Date.now(); // used to suppress actions right after server (re)start
const SERVER_WARMUP = 5 * 60 * 1000; // 5 min warmup — no idle/nudge actions after server start
const START_GRACE_PERIOD = 3 * 60 * 1000; // 3 min grace after start before nudge/idle

export const statsCache = new Map<string, { mem: string; cpu: string }>();

/** Broadcast a monitor event to the feed panel. */
function notifyFeed(ctx: ServerContext, role: string, project: string, text: string): void {
  const broadcast = (ctx as any)._broadcastFeed as ((msg: Record<string, unknown>) => void) | undefined;
  if (broadcast) broadcast({ type: "role", role: `${role} [monitor]`, project, text, time: new Date().toISOString() });
}

/** Safely parse a loop_interval value (e.g. "10m", 10, undefined) to minutes. */
function parseIntervalMinutes(interval: string | number | undefined): number {
  if (typeof interval === "number") return interval;
  const n = parseInt(String(interval), 10);
  return Number.isNaN(n) || n <= 0 ? 10 : n;
}

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

/** Send Ctrl-C (interrupt) + Escape to a role's tmux session. */
function sendToRoleInterrupt(sessionName: string, launchMode: string | undefined): void {
  if (launchMode === "host") {
    execFileSync("tmux", ["send-keys", "-t", sessionName, "C-c"], { stdio: "ignore", timeout: 5000 });
    execFileSync("tmux", ["send-keys", "-t", sessionName, "Escape"], { stdio: "ignore", timeout: 5000 });
  } else {
    execFileSync("docker", ["exec", sessionName, "gosu", gosuUser, "bash", "-c",
      `tmux -f /dev/null send-keys -t claude C-c 2>/dev/null; tmux -f /dev/null send-keys -t claude Escape 2>/dev/null`
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
  lastIdleContent.delete(key);
  lastNudge.delete(key);
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

        // Brain-dead: running but no activity for extended period
        if (running && shouldRun && !isInGracePeriod(key)) {
          try {
            const stmPath = path.join(roleDir(p.root, name), "memory", "short-term.md");
            const stmStat = fs.statSync(stmPath);
            const stmAgeMs = now - stmStat.mtimeMs;
            const intervalMin = parseIntervalMinutes(rc.loop_interval);
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
                notifyFeed(ctx, name, p.slug, `brain-dead (${Math.round(stmAgeMs / 60000)}min stale), restarting...`);
                stopRoleManaged(ctx, p.root, p.slug, name, { keepDesiredState: true, reason: "brain-dead" });
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
                notifyFeed(ctx, name, p.slug, `requested context restart`);
                fs.writeFileSync(hbPath, JSON.stringify({ ts: now, restarted_at: new Date().toISOString() }));
                stopRoleManaged(ctx, p.root, p.slug, name, { keepDesiredState: true, reason: "context-cleanup" });
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
  if (Date.now() - serverStartTime < SERVER_WARMUP) return; // no nudging during warmup
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

        const intervalMin = parseIntervalMinutes(rc.loop_interval);
        const threshold = Math.max(intervalMin * 1.5, 10);
        const stmPath = path.join(roleDir(p.root, name), "memory", "short-term.md");
        try {
          const stat = fs.statSync(stmPath);
          const ageMin = (now - stat.mtimeMs) / 60000;
          const entry = ctx.ttydProcesses.get(key);
          if (!entry) continue;
          if (ageMin > threshold) {
            // Don't nudge if role is past idle cleanup threshold — cleanup will handle it
            const staleThresholdMin = intervalMin * 3;
            if (ageMin > staleThresholdMin) continue;
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
 * Detect if short-term.md content indicates an idle role.
 * Matches: explicit "No tasks, idle", or content unchanged across writes (stuck role).
 */
function isIdleContent(content: string, key: string): boolean {
  // Explicit idle phrase
  if (/^No tasks,?\s*idle/im.test(content)) return true;

  // Content unchanged from last check = role is stuck/idle (writing same thing repeatedly)
  const prev = lastIdleContent.get(key);
  const normalized = content.replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/g, "").trim(); // strip timestamps
  if (prev && prev === normalized) return true;
  lastIdleContent.set(key, normalized);

  // In-progress and Next sections are empty = nothing to do
  const hasInProgress = /^## In-progress\n+[^(\n#]/.test(content) || /In-progress.*:\s*\S/m.test(content);
  const hasNextFocus = /^## Next focus\n+[^(\n#]/.test(content) || /Next focus.*:\s*\S/m.test(content);
  if (!hasInProgress && !hasNextFocus) {
    // Check if Done section only has trivial content
    const doneSection = content.match(/^## Done\n([\s\S]*?)(?=\n## |$)/m);
    if (doneSection) {
      const doneText = doneSection[1].trim();
      if (!doneText || /^[-*]\s*(None|nothing|idle|no tasks|updated)/im.test(doneText)) return true;
    }
  }

  return false;
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
          const intervalMin = parseIntervalMinutes((rc as any).loop_interval);
          const staleThresholdMs = intervalMin * 3 * 60 * 1000; // 3x loop interval

          if (currentMtime === prevMtime) {
            // File not rewritten — role may be stuck. If stale enough, count as idle.
            const ageMs = now - currentMtime;
            if (ageMs < staleThresholdMs) continue; // not stale enough yet
            // Stale and unchanged — increment idle count each check cycle
            idleCount.set(key, (idleCount.get(key) || 0) + 1);
          } else {
            // File was rewritten — check content
            lastIdleMtime.set(key, currentMtime);
            const content = fs.readFileSync(stmPath, "utf-8");
            const isIdle = isIdleContent(content, key);
            if (isIdle) {
              idleCount.set(key, (idleCount.get(key) || 0) + 1);
            } else {
              idleCount.set(key, 0);
              idleResetCount.delete(key); // role did real work — allow future resets
              lastIdleContent.delete(key);
              continue;
            }
          }

          if ((idleCount.get(key) || 0) < 2) continue;

          // Inbox check: skip cleanup only if role recently wrote STM (might process inbox soon)
          if (hasUnprocessedInbox(p.root, name)) {
            const stmAgeMs = now - stat.mtimeMs;
            const intervalMs = parseIntervalMinutes((rc as any).loop_interval) * 60 * 1000;
            if (stmAgeMs < intervalMs * 3) {
              console.log(`[idle-cleanup] ${name} idle but has inbox and recent STM — skipping`);
              idleCount.set(key, 0);
              continue;
            }
            // Stuck: has inbox but no STM update for 3x loop interval — force cleanup
            console.log(`[idle-cleanup] ${name} stuck with unprocessed inbox for ${Math.round(stmAgeMs / 60000)}min — forcing cleanup`);
            notifyFeed(ctx, name, p.slug, `stuck ${Math.round(stmAgeMs / 60000)}min with unprocessed inbox, forcing reset`);
          }

          // Suppress nudging immediately — we're about to reset this role
          lastNudge.set(key, now);

          // Stop resetting if we've already tried multiple times — role is genuinely idle
          const resets = idleResetCount.get(key) || 0;
          if (resets >= MAX_IDLE_RESETS) {
            // Already reset multiple times, still idle — accept it, don't loop forever
            idleCount.set(key, 0);
            continue;
          }

          // Threshold reached — take action based on idle_policy
          const policy = (rc as any).idle_policy || (rc.type === "lead" ? "compact" : "reset");
          const sessionName = containerName(p.slug, name);

          if (policy === "ignore") {
            idleCount.set(key, 0);
            continue;
          } else if (policy === "stop") {
            try {
              stopRoleManaged(ctx, p.root, p.slug, name, { userStopped: false, reason: "idle-cleanup-stop" });
              console.log(`[idle-cleanup] Stopped idle role ${name} (policy: stop)`);
              notifyFeed(ctx, name, p.slug, `idle → stopped (policy: stop)`);
            } catch (e) { console.error(`[idle-cleanup] Failed to stop ${name}:`, e); }
          } else if (policy === "compact") {
            try {
              sendToRole(sessionName, rc.launch_mode, "/compact");
              console.log(`[idle-cleanup] Sent /compact to ${name}`);
              notifyFeed(ctx, name, p.slug, `idle, sent /compact`);
            } catch (e) { console.error(`[idle-cleanup] Failed to send /compact to ${name}:`, e); }
          } else {
            // "reset" (default for workers): /clear + /loop
            const roleRootRel = `.evomesh/roles/${name}`;
            const loopInterval = rc.loop_interval || "10m";
            const loopCmd = `/loop ${loopInterval} You are the ${name} role. FIRST: cat and read ${roleRootRel}/ROLE.md completely. Then follow CLAUDE.md loop flow. Working directory: ${roleRootRel}/`;
            try {
              sendToRoleInterrupt(sessionName, rc.launch_mode);
              sendToRoleSequence(sessionName, rc.launch_mode, [
                { message: "/clear", delaySec: 2 },
                { message: loopCmd, delaySec: 10 },
              ]);
              console.log(`[idle-cleanup] Sent interrupt + /clear + /loop to worker ${name}`);
              notifyFeed(ctx, name, p.slug, `idle/stuck → interrupt + /clear + /loop`);
            } catch (e) { console.error(`[idle-cleanup] Failed to send /clear + /loop to ${name}:`, e); }
          }

          // Reset counter, record action time, increment reset count
          // Also suppress nudging during the reset sequence
          idleCount.set(key, 0);
          lastIdleAction.set(key, now);
          lastNudge.set(key, now);
          idleResetCount.set(key, resets + 1);
        } catch (e) { console.error(`[idle-cleanup] Error checking ${name}:`, e); }
      }
    }
  } catch (e) { console.error("[cleanupIdleRoles] Error:", e); }
}
