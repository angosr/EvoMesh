import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { loadConfig } from "../config/loader.js";
import { expandHome } from "../utils/paths.js";
import { errorMessage } from "../utils/error.js";
import { formatBytes } from "../utils/fs.js";
import type { SessionInfo } from "./auth.js";
import type { ServerContext } from "./index.js";

export function registerUsageRoutes(app: import("express").Express, ctx: ServerContext): void {

  // --- Accounts ---

  app.get("/api/accounts", (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }
    try {
      const lu = session.linuxUser || process.env.USER || "user";
      const homeDir = lu === (process.env.USER || "user") ? os.homedir() : `/home/${lu}`;
      const detected = fs.readdirSync(homeDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith(".claude"))
        .map(e => ({
          name: e.name.replace(/^\.claude/, "") || "default",
          path: `~/${e.name}`,
          fullPath: path.join(homeDir, e.name),
          needsLogin: ctx.checkNeedsLogin(path.join(homeDir, e.name)),
        }));
      res.json({ accounts: detected });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  // --- Account usage info ---

  app.get("/api/usage/accounts", (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }
    if (session.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
    try {
      const lu = session.linuxUser || process.env.USER || "user";
      const homeDir = lu === (process.env.USER || "user") ? os.homedir() : `/home/${lu}`;
      const now = Date.now();
      const DAY_MS = 86400000;
      const accounts = fs.readdirSync(homeDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith(".claude"))
        .map(e => {
          const dir = path.join(homeDir, e.name);
          const name = e.name.replace(/^\.claude/, "") || "default";
          let email: string | null = null;
          let subscriptionType: string | null = null;
          let rateLimitTier: string | null = null;
          let tokenExpiresAt: number | null = null;
          try {
            const claudeJson = JSON.parse(fs.readFileSync(path.join(dir, ".claude.json"), "utf-8"));
            email = claudeJson.email || claudeJson.oauthAccount?.emailAddress || null;
            subscriptionType = claudeJson.subscriptionType || null;
          } catch (err) { console.error(`Failed to read .claude.json for account "${name}":`, errorMessage(err)); }
          try {
            const cred = JSON.parse(fs.readFileSync(path.join(dir, ".credentials.json"), "utf-8"));
            const oauth = cred.claudeAiOauth || {};
            if (!subscriptionType) subscriptionType = oauth.subscriptionType || null;
            rateLimitTier = oauth.rateLimitTier || null;
            tokenExpiresAt = oauth.expiresAt || null;
          } catch (err) { console.error(`Failed to read .credentials.json for account "${name}":`, errorMessage(err)); }
          let inputTokens = 0, outputTokens = 0, cacheCreation = 0, cacheRead = 0, activeSessions = 0;
          const projDir = path.join(dir, "projects");
          try {
            if (fs.existsSync(projDir)) {
              for (const pd of fs.readdirSync(projDir)) {
                const pdPath = path.join(projDir, pd);
                if (!fs.statSync(pdPath).isDirectory()) continue;
                for (const jf of fs.readdirSync(pdPath).filter(f => f.endsWith(".jsonl"))) {
                  const jfPath = path.join(pdPath, jf);
                  try { if (now - fs.statSync(jfPath).mtimeMs > DAY_MS) continue; } catch { continue; }
                  activeSessions++;
                  try {
                    const content = fs.readFileSync(jfPath, "utf-8");
                    for (const line of content.split("\n")) {
                      if (!line.includes("input_tokens")) continue;
                      try {
                        const d = JSON.parse(line);
                        const u = d.message?.usage;
                        if (u) {
                          inputTokens += u.input_tokens || 0;
                          outputTokens += u.output_tokens || 0;
                          cacheCreation += u.cache_creation_input_tokens || 0;
                          cacheRead += u.cache_read_input_tokens || 0;
                        }
                      } catch (err) { console.error(`Failed to parse usage line in ${jfPath}:`, errorMessage(err)); }
                    }
                  } catch (err) { console.error(`Failed to read session file ${jfPath}:`, errorMessage(err)); }
                }
              }
            }
          } catch (err) { console.error(`Failed to scan projects dir for account "${name}":`, errorMessage(err)); }
          const projects = ctx.getProjects(session.linuxUser);
          let roleCount = 0;
          for (const p of projects) {
            try {
              const config = loadConfig(p.root);
              for (const rc of Object.values(config.roles)) {
                const acctPath = expandHome(config.accounts[rc.account] || "~/.claude");
                if (acctPath === dir) roleCount++;
              }
            } catch (err) { console.error(`Failed to load config for project ${p.root}:`, errorMessage(err)); }
          }
          return {
            name, path: `~/${e.name}`, email, subscriptionType, rateLimitTier,
            tokenExpiresAt, tokenExpiresIn: tokenExpiresAt ? Math.max(0, tokenExpiresAt - now) : null,
            roleCount, activeSessions, needsLogin: ctx.checkNeedsLogin(dir),
            usage24h: { inputTokens, outputTokens, cacheCreation, cacheRead,
              total: inputTokens + outputTokens + cacheCreation + cacheRead },
          };
        });
      res.json({ accounts });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  // --- System metrics ---

  app.get("/api/metrics", (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }
    if (session.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
    try {
      const cpus = os.cpus();
      const load1 = os.loadavg()[0];
      const cpuPercent = Math.min(100, Math.round((load1 / cpus.length) * 100));
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
      let diskPercent = 0, diskUsed = "", diskTotal = "";
      try {
        const df = execFileSync("df", ["-h", "/"], { encoding: "utf-8" });
        const parts = df.trim().split("\n")[1].split(/\s+/);
        diskTotal = parts[1]; diskUsed = parts[2]; diskPercent = parseInt(parts[4], 10) || 0;
      } catch (err) { console.error("Failed to read disk usage:", errorMessage(err)); }
      res.json({
        cpu: { percent: cpuPercent, cores: cpus.length, load1: load1.toFixed(2) },
        memory: { percent: memPercent, used: formatBytes(totalMem - freeMem), total: formatBytes(totalMem) },
        disk: { percent: diskPercent, used: diskUsed, total: diskTotal },
      });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });
}
