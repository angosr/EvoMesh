/**
 * Health monitoring: registry, auto-restart, brain-dead detection, compliance nudging.
 * Extracted from index.ts to keep it under 500 lines.
 */
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { loadConfig } from "../config/loader.js";
import { isRoleRunning, getContainerPort, getContainerState, startRole, stopRole } from "../process/container.js";
import { roleDir } from "../utils/paths.js";
import { ensureCentralAI } from "./routes-admin.js";
import { allocatePort } from "./routes.js";
import type { ServerContext } from "./index.js";

let lastGoodProjects: Record<string, any> = {};
let centralRestartFails = 0;
const prevRunning = new Map<string, boolean>();
const lastRestart = new Map<string, number>();
const lastNudge = new Map<string, number>();
const RESTART_COOLDOWN = 5 * 60 * 1000;
const NUDGE_COOLDOWN = 5 * 60 * 1000;

export const statsCache = new Map<string, { mem: string; cpu: string }>();

// --- Desired state persistence: which roles SHOULD be running ---
const DESIRED_STATE_FILE = path.join(os.homedir(), ".evomesh", "running-roles.json");

function loadDesiredState(): Record<string, boolean> {
  try {
    if (fs.existsSync(DESIRED_STATE_FILE)) return JSON.parse(fs.readFileSync(DESIRED_STATE_FILE, "utf-8"));
  } catch {}
  return {};
}

function saveDesiredState(state: Record<string, boolean>): void {
  try { fs.writeFileSync(DESIRED_STATE_FILE, JSON.stringify(state, null, 2), "utf-8"); } catch {}
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
      if (isRoleRunning(project.root, roleName)) continue; // already running
      const ttydPort = allocatePort(ctx);
      startRole(project.root, roleName, rc, config, ttydPort);
      ctx.ttydProcesses.set(key, { port: ttydPort, roleName, projectSlug: slug });
      console.log(`[restore] Started ${roleName} in ${project.name} (port ${ttydPort})`);
    } catch (e) { console.error(`[restore] Failed to start ${roleName}:`, e); }
  }
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
      } catch {}
      accountHealthCache.set(dir, needsLogin);
    }
  } catch {}
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
          const cname = `evomesh-${p.slug}-${name}`;
          const accountPath = path.join(os.homedir(), config.accounts[rc.account] || ".claude");
          const accountDown = isAccountDown(accountPath);
          roles[name] = { configured: true, running, port: running ? getContainerPort(cname) : null, accountDown: accountDown || undefined };
        }
        projectEntries[p.slug] = { path: p.root, roles };
      } catch {
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
    } catch {}

    // Central AI auto-recovery
    const centralName = `evomesh-${process.env.USER || "user"}-central`;
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
        const wasRunning = prevRunning.get(key) ?? false;
        prevRunning.set(key, running);

        // Crashed: was running, now stopped, should be running
        if (wasRunning && !running && shouldRun) {
          const lastTime = lastRestart.get(key) || 0;
          if (now - lastTime < RESTART_COOLDOWN) continue;
          console.log(`[auto-restart] ${name} crashed in ${p.name}, restarting...`);
          try {
            const ttydPort = allocatePort(ctx);
            startRole(p.root, name, rc, config, ttydPort);
            ctx.ttydProcesses.set(key, { port: ttydPort, roleName: name, projectSlug: p.slug });
            lastRestart.set(key, now);
          } catch (e) { console.error(`[auto-restart] Failed to restart ${name}:`, e); }
        }

        // Brain-dead: running but heartbeat stale + no commits → force stop (next cycle restarts)
        if (running && shouldRun) {
          try {
            const hbPath = path.join(roleDir(p.root, name), "heartbeat.json");
            const hbStat = fs.statSync(hbPath);
            const hbAgeMs = now - hbStat.mtimeMs;
            const intervalMin = parseInt(rc.loop_interval) || 10;
            const hbThreshold = intervalMin * 2 * 60 * 1000;
            const lastTime = lastRestart.get(key) || 0;
            if (hbAgeMs > hbThreshold && (now - lastTime) > 10 * 60 * 1000) {
              let hasRecentCommit = false;
              try {
                const gitLog = execFileSync("git", ["log", "--oneline", `--since=${intervalMin * 2} minutes ago`, `--grep=${name}`], { cwd: p.root, encoding: "utf-8", timeout: 5000 });
                hasRecentCommit = gitLog.trim().length > 0;
              } catch {}
              if (!hasRecentCommit) {
                console.log(`[brain-dead] ${name} heartbeat ${Math.round(hbAgeMs / 60000)}min stale, restarting`);
                stopRole(p.root, name);
                lastRestart.set(key, now);
              }
            }
          } catch {}

          // Context cleanup: role requests restart via heartbeat.json content
          try {
            const hbPath = path.join(roleDir(p.root, name), "heartbeat.json");
            const hbContent = JSON.parse(fs.readFileSync(hbPath, "utf-8"));
            if (hbContent.request === "restart") {
              const lastTime = lastRestart.get(key) || 0;
              if (now - lastTime > RESTART_COOLDOWN) {
                console.log(`[context-cleanup] ${name} requested restart (reason: ${hbContent.reason || "unknown"})`);
                fs.writeFileSync(hbPath, JSON.stringify({ ts: now, restarted_at: new Date().toISOString() }));
                stopRole(p.root, name);
                  lastRestart.set(key, now);
                }
              }
            }
          } catch {}
        }
      }
    }
  } catch {}
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
            const sessionName = `evomesh-${p.slug}-${name}`;
            const nudgeMsg = "[SYSTEM] Write memory/short-term.md and append metrics.log before continuing.";
            try {
              if (rc.launch_mode === "host") {
                execFileSync("tmux", ["send-keys", "-t", sessionName, "-l", nudgeMsg], { stdio: "ignore", timeout: 5000 });
                execFileSync("tmux", ["send-keys", "-t", sessionName, "Enter"], { stdio: "ignore", timeout: 5000 });
              } else {
                execFileSync("docker", ["exec", sessionName, "bash", "-c",
                  `tmux -f /dev/null send-keys -t claude -l "${nudgeMsg}" 2>/dev/null; tmux -f /dev/null send-keys -t claude Enter 2>/dev/null`
                ], { stdio: "ignore", timeout: 5000 });
              }
              lastNudge.set(key, now);
              console.log(`[verify] Nudged ${name} — memory ${Math.round(ageMin)}min stale`);
            } catch {}
          }
        } catch {}
      }
    }
  } catch {}
}
