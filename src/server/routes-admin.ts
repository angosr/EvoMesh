import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { loadConfig } from "../config/loader.js";
import { expandHome } from "../utils/paths.js";
import { errorMessage } from "../utils/error.js";
import { slugify } from "../workspace/config.js";
import { getContainerState, getContainerPort, containerName, centralContainerName } from "../process/container.js";
import type { ServerContext } from "./index.js";
import type { SessionInfo } from "./auth.js";
import { requireProjectRole, allocatePort, reqLinuxUser } from "./routes.js";

/** Validate that a string is a safe shell-literal (alphanumeric, dash, underscore, dot). */
function isSafeShellToken(s: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(s);
}

/** Kill any existing ttyd process bound to the given tmux session name. */
function killExistingTtyd(sessionName: string): void {
  try {
    const pids = execFileSync("pgrep", ["-f", `ttyd.*${sessionName}`], {
      encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    if (pids) {
      for (const pid of pids.split("\n")) {
        try { execFileSync("kill", [pid.trim()], { stdio: "ignore" }); }
        catch { /* process may have already exited */ }
      }
    }
  } catch { /* no matching ttyd process found — ok */ }
}

/**
 * Ensure Central AI is running. Uses host tmux mode (no Docker).
 * Returns { port, terminal } or null on failure.
 */
export function ensureCentralAI(ctx: ServerContext): { port: number; terminal: string } | null {
  const sessionName = centralContainerName();

  // Reuse existing port if already tracked, otherwise allocate a new one
  const existingEntry = ctx.ttydProcesses.get("central/ai");
  const adminPort = existingEntry ? existingEntry.port : allocatePort(ctx);

  // Already running? Just register and return.
  if (getContainerState(sessionName) === "running") {
    ctx.ttydProcesses.set("central/ai", { port: adminPort, roleName: "ai", projectSlug: "central" });
    return { port: adminPort, terminal: "/terminal/central/ai/" };
  }

  // Validate sessionName before using in shell commands
  if (!isSafeShellToken(sessionName)) {
    console.error(`[central-ai] Invalid session name: ${sessionName}`);
    return null;
  }

  try {
    const homeDir = os.homedir();

    // Find account
    let accountPath = path.join(homeDir, ".claude");
    try {
      const projects = ctx.getProjects();
      if (projects.length > 0) {
        const config = loadConfig(projects[0].root);
        const firstAccount = Object.values(config.accounts)[0];
        if (firstAccount) accountPath = expandHome(firstAccount);
      }
    } catch (e: unknown) {
      console.warn("[central-ai] Failed to load account config, using default:", errorMessage(e));
    }

    // Validate accountPath before shell interpolation
    if (!isSafeShellToken(path.basename(accountPath))) {
      console.error(`[central-ai] Unsafe account path: ${accountPath}`);
      return null;
    }

    // Session ID for resume
    const centralDir = path.join(homeDir, ".evomesh", "central");
    const sessionIdFile = path.join(centralDir, ".session-id");
    const claudeArgParts: string[] = [];
    if (fs.existsSync(sessionIdFile)) {
      const sid = fs.readFileSync(sessionIdFile, "utf-8").trim();
      if (sid) {
        if (!isSafeShellToken(sid)) {
          console.error("[central-ai] Unsafe session ID, ignoring resume");
        } else {
          claudeArgParts.push("--resume", sid);
        }
      }
      if (claudeArgParts.length === 0) claudeArgParts.push("--name", "central");
    } else {
      claudeArgParts.push("--name", "central");
    }
    claudeArgParts.push("--dangerously-skip-permissions");
    const claudeArgs = claudeArgParts.join(" ");

    // Start tmux session with claude — cwd is ~/.evomesh/central/ so Claude Code loads CLAUDE.md from there
    const claudeCmd = `CLAUDE_CONFIG_DIR=${accountPath} claude ${claudeArgs}; exec bash`;
    execFileSync("tmux", [
      "-f", "/dev/null", "new-session", "-d", "-s", sessionName, "-x", "120", "-y", "40", claudeCmd,
    ], { cwd: centralDir, stdio: "ignore" });

    // Kill any leftover ttyd for this session before starting a new one
    killExistingTtyd(sessionName);

    // Start ttyd pointing at tmux session using execFileSync with array args
    const logFile = `/tmp/ttyd-${sessionName}.log`;
    execFileSync("bash", ["-c",
      `nohup ttyd --writable -t fontSize=14 -t scrollback=10000 --port ${adminPort} -- tmux attach-session -t ${sessionName} > ${logFile} 2>&1 &`,
    ], { stdio: "ignore" });

    // Send /loop command after delay (background)
    const loopCmd = `/loop 5m You are the central role. FIRST: cat and read ROLE.md completely. Then follow CLAUDE.md loop flow. MANDATORY: write central-status.md every loop (Now/Next/Risk per project).`;
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

    ctx.ttydProcesses.set("central/ai", { port: adminPort, roleName: "ai", projectSlug: "central" });
    console.log(`[central-ai] Started in host tmux mode on port ${adminPort}`);
    return { port: adminPort, terminal: "/terminal/central/ai/" };
  } catch (e: unknown) {
    console.error("[central-ai] Failed to start:", errorMessage(e));
    return null;
  }
}

export function registerAdminRoutes(app: import("express").Express, ctx: ServerContext): void {

  // Ensure Central AI is always running on server startup
  try {
    const result = ensureCentralAI(ctx);
    if (result) console.log(`[central-ai] Running on port ${result.port}`);
    else console.error("[central-ai] Failed to start on boot");
  } catch (e: unknown) { console.error("[central-ai] Boot error:", errorMessage(e)); }

  // --- Admin AI terminal ---
  app.get("/api/admin/status", (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session || session.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
    // Ensure it's running (auto-restart if crashed)
    const result = ensureCentralAI(ctx);
    if (result) {
      res.json({ running: true, port: result.port, terminal: result.terminal });
    } else {
      res.json({ running: false, port: null, terminal: null });
    }
  });

  app.post("/api/admin/start", (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session || session.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
    const result = ensureCentralAI(ctx);
    if (result) {
      res.json({ ok: true, ...result });
    } else {
      res.status(500).json({ error: "Failed to start Central AI" });
    }
  });

  // Central AI status (read central-status.md)
  app.get("/api/admin/central-status", (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session || session.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
    const statusFile = path.join(os.homedir(), ".evomesh", "central", "central-status.md");
    try {
      if (fs.existsSync(statusFile)) {
        res.type("text").send(fs.readFileSync(statusFile, "utf-8"));
      } else {
        res.type("text").send("Central AI starting...");
      }
    } catch (e: unknown) { console.warn("[central-ai] Failed to read central-status.md:", errorMessage(e)); res.type("text").send("Unable to read status"); }
  });

  // Send message to central AI inbox
  app.post("/api/admin/message", (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session || session.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
    const { message } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) { res.status(400).json({ error: "Empty" }); return; }
    try {
      const inboxDir = path.join(os.homedir(), ".evomesh", "central", "inbox");
      fs.mkdirSync(inboxDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
      const filename = `${ts}_user_command.md`;
      fs.writeFileSync(path.join(inboxDir, filename),
        `---\nfrom: user\npriority: P0\ntype: command\n---\n\n${message.trim()}\n`, "utf-8");

      // Also try to send directly to central AI's tmux session (host mode)
      const sessionName = centralContainerName();
      try {
        execFileSync("tmux", ["send-keys", "-t", sessionName, "-l",
          message.trim()], { stdio: "ignore" });
        execFileSync("tmux", ["send-keys", "-t", sessionName, "Enter"], { stdio: "ignore" });
      } catch (e: unknown) {
        console.warn("[central-ai] Failed to send keys to tmux session:", errorMessage(e));
      }

      // Broadcast to SSE feed subscribers
      const feedSubs = (ctx as any)._feedSubscribers as Set<import("express").Response> | undefined;
      if (feedSubs) {
        const event = JSON.stringify({ type: "user-message", text: message.trim(), time: new Date().toISOString() });
        for (const sub of feedSubs) { try { sub.write(`data: ${event}\n\n`); } catch { /* SSE subscriber disconnected */ } }
      }

      res.json({ ok: true });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  // --- Scroll: tmux copy-mode scroll via docker exec ---
  app.post("/api/projects/:slug/roles/:name/scroll", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project || !/^[a-zA-Z0-9_-]+$/.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const { direction, lines } = req.body;
    if (!["up", "down", "esc"].includes(direction)) { res.status(400).json({ error: "Bad direction" }); return; }
    const projectSlug = slugify(path.basename(project.root));
    const cname = containerName(projectSlug, req.params.name);
    const user = process.env.USER || "user";
    try {
      if (direction === "esc") {
        // Exit copy-mode: send 'q'
        execFileSync("docker", ["exec", cname, "gosu", user, "tmux", "send-keys", "-t", "claude", "q"], { stdio: "ignore" });
      } else {
        const n = Math.min(Math.max(parseInt(lines) || 3, 1), 20);
        const cmd = direction === "up" ? "scroll-up" : "scroll-down";
        // Batch: enter copy-mode + scroll N times in a single shell command
        const tmuxCmds = direction === "up" ? `tmux copy-mode -t claude 2>/dev/null; ` : "";
        const scrollCmds = Array(n).fill(`tmux send-keys -t claude -X ${cmd}`).join("; ");
        execFileSync("docker", ["exec", cname, "gosu", user, "bash", "-c", tmuxCmds + scrollCmds], { stdio: "ignore" });
      }
      res.json({ ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Scroll failed for ${cname}:`, msg);
      res.status(500).json({ error: "Failed", container: cname, detail: msg });
    }
  });
}
