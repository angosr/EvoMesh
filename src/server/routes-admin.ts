import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { loadConfig } from "../config/loader.js";
import { expandHome } from "../utils/paths.js";
import { slugify } from "../workspace/config.js";
import { getContainerState, getContainerPort } from "../process/container.js";
import type { ServerContext } from "./index.js";
import type { SessionInfo } from "./auth.js";
import { requireProjectRole } from "./routes.js";

export function registerAdminRoutes(app: import("express").Express, ctx: ServerContext): void {

  // --- Admin AI terminal ---
  app.get("/api/admin/status", (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session || session.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
    try {
      const state = getContainerState(`evomesh-${process.env.USER || "user"}-central`);
      const port = state === "running" ? getContainerPort(`evomesh-${process.env.USER || "user"}-central`) : null;
      res.json({ running: state === "running", port, terminal: state === "running" ? "/terminal/central/ai/" : null });
    } catch { res.json({ running: false, port: null, terminal: null }); }
  });

  app.post("/api/admin/start", (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session || session.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
    try {
      const homeDir = os.homedir();
      const adminPort = ctx.port + 100; // Use high offset to avoid collision
      // Remove old container
      try { execFileSync("docker", ["rm", "-f", `evomesh-${process.env.USER || "user"}-central`], { stdio: ["pipe","pipe","ignore"] }); } catch {}

      // Central AI uses the first available account from workspace projects
      const expandHomePath = (p: string) => p.startsWith("~/") ? path.join(homeDir, p.slice(2)) : p;
      let accountPath = path.join(homeDir, ".claude"); // fallback
      try {
        const projects = ctx.getProjects();
        if (projects.length > 0) {
          const config = loadConfig(projects[0].root);
          const firstAccount = Object.values(config.accounts)[0];
          if (firstAccount) accountPath = expandHomePath(firstAccount);
        }
      } catch {}
      const mainClaudeJson = path.join(homeDir, ".claude.json");

      // Start central AI container — bridge network like normal roles
      const args = [
        "run", "-d",
        "--name", `evomesh-${process.env.USER || "user"}-central`,
        "-p", `127.0.0.1:${adminPort}:7681`,
        "-v", `${homeDir}:${homeDir}:rw`,
        "-v", `${mainClaudeJson}:${mainClaudeJson}:rw`,
        "-e", `HOST_UID=${process.getuid?.() || 1000}`,
        "-e", `HOST_GID=${process.getgid?.() || 1000}`,
        "-e", `HOST_USER=${process.env.USER || "user"}`,
        "-e", `HOST_HOME=${homeDir}`,
        "-e", `HOME=${homeDir}`,
        "-e", `CLAUDE_CONFIG_DIR=${accountPath}`,
        "-e", "ROLE_NAME=central",
        "-e", "ROLE_ROOT_OVERRIDE=.evomesh/central",
        "-w", `${homeDir}`,
        "--log-opt", "max-size=10m",
        "evomesh-role",
      ];
      execFileSync("docker", args, { stdio: "inherit" });

      ctx.ttydProcesses.set("central/ai", { port: adminPort, roleName: "ai", projectSlug: "central" });
      res.json({ ok: true, port: adminPort, terminal: "/terminal/central/ai/" });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Central AI status (read central-status.md)
  app.get("/api/admin/central-status", (_req, res) => {
    const statusFile = path.join(os.homedir(), ".evomesh", "central", "central-status.md");
    try {
      if (fs.existsSync(statusFile)) {
        res.type("text").send(fs.readFileSync(statusFile, "utf-8"));
      } else {
        res.type("text").send("Central AI starting...");
      }
    } catch { res.type("text").send("Unable to read status"); }
  });

  // Send message to central AI inbox
  app.post("/api/admin/message", (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) { res.status(400).json({ error: "Empty" }); return; }
    try {
      const inboxDir = path.join(os.homedir(), ".evomesh", "central", "inbox");
      fs.mkdirSync(inboxDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
      const filename = `${ts}_user_command.md`;
      fs.writeFileSync(path.join(inboxDir, filename),
        `---\nfrom: user\npriority: high\ntype: command\n---\n\n${message.trim()}\n`, "utf-8");

      // Also try to send directly to central AI's tmux if running
      const cname = `evomesh-${process.env.USER || "user"}-central`;
      const user = process.env.USER || "user";
      try {
        execFileSync("docker", ["exec", cname, "gosu", user, "tmux", "send-keys", "-t", "claude", "-l",
          `[User Command] ${message.trim()}`], { stdio: "ignore" });
        execFileSync("docker", ["exec", cname, "gosu", user, "tmux", "send-keys", "-t", "claude", "Enter"], { stdio: "ignore" });
      } catch {}

      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Scroll: tmux copy-mode scroll via docker exec ---
  app.post("/api/projects/:slug/roles/:name/scroll", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project || !/^[a-zA-Z0-9_-]+$/.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const { direction, lines } = req.body;
    if (!["up", "down", "esc"].includes(direction)) { res.status(400).json({ error: "Bad direction" }); return; }
    const cname = `evomesh-${slugify(path.basename(project.root))}-${req.params.name}`;
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
    } catch { res.status(500).json({ error: "Failed" }); }
  });
}
