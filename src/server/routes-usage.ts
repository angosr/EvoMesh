import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/loader.js";
import { expandHome } from "../utils/paths.js";
import { errorMessage } from "../utils/error.js";
import { formatBytes } from "../utils/fs.js";
import type { SessionInfo } from "./auth.js";
import type { ServerContext } from "./index.js";
import { findBinary, getProvider, listAccountDirs, detectProvider, getProviderNames } from "../provider.js";
import type { ProviderName } from "../provider.js";

// Active login processes — keyed by account path
const loginProcesses = new Map<string, { proc: import("node:child_process").ChildProcess; authUrl: string }>();


// One-time invite links — keyed by invite code
interface InviteLink {
  code: string;
  accountPath: string;   // resolved absolute path
  accountName: string;
  provider: ProviderName;
  createdBy: string;
  createdAt: number;
  expiresAt: number;     // auto-expire after 24h even if unused
}
const inviteLinks = new Map<string, InviteLink>();

function generateInviteCode(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function registerUsageRoutes(app: import("express").Express, ctx: ServerContext): void {

  // --- Accounts ---

  app.get("/api/accounts", (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }
    try {
      const lu = session.linuxUser || process.env.USER || "user";
      const homeDir = lu === (process.env.USER || "user") ? os.homedir() : `/home/${lu}`;
      const detected: any[] = [];
      for (const provName of getProviderNames()) {
        const prov = getProvider(provName);
        for (const acct of listAccountDirs(homeDir, provName)) {
          detected.push({
            name: acct.name,
            path: `~/${acct.dirName}`,
            fullPath: acct.fullPath,
            provider: provName,
            providerDisplay: prov.displayName,
            needsLogin: prov.needsLogin(acct.fullPath),
          });
        }
      }
      res.json({ accounts: detected });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  // --- Create account ---
  app.post("/api/accounts", (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session || session.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
    const { name } = req.body;
    if (!name || typeof name !== "string") { res.status(400).json({ error: "Account name required" }); return; }
    const safeName = name.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeName) { res.status(400).json({ error: "Invalid account name" }); return; }
    const dirName = safeName === "default" ? ".claude" : `.claude-${safeName}`;
    const lu = session.linuxUser || process.env.USER || "user";
    const homeDir = lu === (process.env.USER || "user") ? os.homedir() : `/home/${lu}`;
    const fullPath = path.join(homeDir, dirName);
    if (fs.existsSync(fullPath)) { res.status(409).json({ error: `Account "${safeName}" already exists at ~/${dirName}` }); return; }
    try {
      fs.mkdirSync(fullPath, { recursive: true, mode: 0o700 });
      console.log(`[accounts] Created account directory: ${fullPath}`);
      res.json({ ok: true, name: safeName, path: `~/${dirName}`, fullPath, needsLogin: true });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  // --- Account login: start login flow, return auth URL ---
  app.post("/api/accounts/login/start", (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session || session.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
    const { accountPath } = req.body;
    if (!accountPath) { res.status(400).json({ error: "accountPath required" }); return; }
    const resolved = expandHome(accountPath);
    if (!fs.existsSync(resolved)) {
      try { fs.mkdirSync(resolved, { recursive: true, mode: 0o700 }); } catch {}
    }

    // Kill any existing login process for this account
    const existing = loginProcesses.get(resolved);
    if (existing) { try { existing.proc.kill(); } catch {} loginProcesses.delete(resolved); }

    // Detect provider from account path and spawn login
    const acctProvider = detectProvider(accountPath);
    const acctProv = getProvider(acctProvider);
    const acctCliBin = findBinary(acctProvider);
    const acctLoginEnv: Record<string, string> = { ...process.env as any };
    if (acctProv.configDirEnv) acctLoginEnv[acctProv.configDirEnv] = resolved;

    let proc: import("node:child_process").ChildProcess;
    try {
      proc = spawn(acctCliBin, acctProv.loginArgs, {
        env: acctLoginEnv,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (e: unknown) {
      res.status(500).json({ error: `Failed to spawn ${acctProv.binaryName}: ${errorMessage(e)}` });
      return;
    }

    let output = "";
    let responded = false;

    proc.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    proc.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString(); });

    proc.on("error", (err) => {
      if (responded) return;
      responded = true;
      clearInterval(pollTimer);
      res.status(500).json({ error: `claude command failed: ${err.message}` });
    });

    proc.on("exit", (exitCode) => {
      loginProcesses.delete(resolved);
      if (responded) return;
      responded = true;
      clearInterval(pollTimer);
      res.status(500).json({ error: `claude exited with code ${exitCode}`, output: output.slice(0, 500) });
    });

    // Poll for auth URL every 200ms
    const pollTimer = setInterval(() => {
      if (responded) return;
      const urlMatch = output.match(/(https:\/\/[^\s]*oauth\/authorize[^\s]+)/);
      if (urlMatch) {
        responded = true;
        clearInterval(pollTimer);
        loginProcesses.set(resolved, { proc, authUrl: urlMatch[1] });
        res.json({ ok: true, authUrl: urlMatch[1], accountPath });
      }
    }, 200);

    // Timeout after 8s
    setTimeout(() => {
      if (responded) return;
      responded = true;
      clearInterval(pollTimer);
      try { proc.kill(); } catch {}
      res.status(500).json({ error: "Timeout waiting for auth URL", output: output.slice(0, 500) });
    }, 8000);
  });

  // --- Account login: submit auth code to complete login ---
  app.post("/api/accounts/login/complete", (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session || session.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
    const { accountPath, code } = req.body;
    if (!accountPath || !code) { res.status(400).json({ error: "accountPath and code required" }); return; }
    const resolved = expandHome(accountPath);
    const entry = loginProcesses.get(resolved);
    if (!entry) { res.status(404).json({ error: "No active login session for this account. Start login first." }); return; }

    // Send the code to claude's stdin
    entry.proc.stdin?.write(code.trim() + "\n");

    // Wait for completion
    let completed = false;
    entry.proc.on("exit", (exitCode) => {
      if (completed) return;
      completed = true;
      loginProcesses.delete(resolved);
      if (exitCode === 0) {
        res.json({ ok: true, message: "Login successful" });
      } else {
        res.json({ ok: false, error: "Login may have failed. Check credentials." });
      }
    });

    // Timeout
    setTimeout(() => {
      if (completed) return;
      completed = true;
      try { entry.proc.kill(); } catch {}
      loginProcesses.delete(resolved);
      // Check if credentials were actually saved
      if (fs.existsSync(path.join(resolved, ".credentials.json"))) {
        res.json({ ok: true, message: "Login completed" });
      } else {
        res.status(500).json({ error: "Login timed out" });
      }
    }, 10000);
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

  // --- Invite links (one-time login sharing) ---

  // Generate an invite link for an account (admin only)
  app.post("/api/accounts/invite", (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session || session.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
    const { accountPath, accountName } = req.body;
    if (!accountPath) { res.status(400).json({ error: "accountPath required" }); return; }
    const resolved = expandHome(accountPath);
    if (!fs.existsSync(resolved)) { res.status(404).json({ error: "Account directory not found" }); return; }

    const code = generateInviteCode();
    const now = Date.now();
    const provider = detectProvider(resolved);
    inviteLinks.set(code, {
      code,
      accountPath: resolved,
      accountName: accountName || path.basename(resolved),
      provider,
      createdBy: session.username,
      createdAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000, // 24h
    });

    // Build the invite URL based on request host
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${ctx.port}`;
    const inviteUrl = `${proto}://${host}/invite/${code}`;

    res.json({ ok: true, code, url: inviteUrl, expiresAt: now + 24 * 60 * 60 * 1000 });
  });

  // Serve invite page (no auth required — checked in auth exempt)
  app.get("/invite/:code", (req, res) => {
    const invite = inviteLinks.get(req.params.code);
    if (!invite || Date.now() > invite.expiresAt) {
      inviteLinks.delete(req.params.code);
      res.status(410).type("html").send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Link Expired</title>
        <style>body{background:#000;color:#e0e0e0;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh}
        .box{background:#111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center}
        h1{color:#38bdf8;font-size:20px;margin-bottom:8px}p{color:#666;font-size:13px}</style></head>
        <body><div class="box"><h1>Link Expired</h1><p>This invite link has expired or already been used.</p></div></body></html>`);
      return;
    }
    const __dir = path.dirname(fileURLToPath(import.meta.url));
    const srcPath = path.join(__dir, "..", "..", "src", "server", "invite.html");
    const distPath = path.join(__dir, "invite.html");
    const p = fs.existsSync(srcPath) ? srcPath : distPath;
    if (!p || !fs.existsSync(p)) { res.status(500).send("Invite page not found"); return; }
    res.type("html").sendFile(path.resolve(p));
  });

  // Get invite info (no auth required)
  app.get("/api/invite/:code", (req, res) => {
    const invite = inviteLinks.get(req.params.code);
    if (!invite || Date.now() > invite.expiresAt) {
      inviteLinks.delete(req.params.code);
      res.status(410).json({ error: "Invite link expired or invalid" });
      return;
    }
    res.json({ accountName: invite.accountName, expiresAt: invite.expiresAt });
  });

  // Start login via invite link (no auth required)
  app.post("/api/invite/:code/login/start", (req, res) => {
    const invite = inviteLinks.get(req.params.code);
    if (!invite || Date.now() > invite.expiresAt) {
      inviteLinks.delete(req.params.code);
      res.status(410).json({ error: "Invite link expired or invalid" });
      return;
    }
    const resolved = invite.accountPath;
    if (!fs.existsSync(resolved)) {
      try { fs.mkdirSync(resolved, { recursive: true, mode: 0o700 }); } catch {}
    }
    // Kill any existing login process for this account
    const existing = loginProcesses.get(resolved);
    if (existing) { try { existing.proc.kill(); } catch {} loginProcesses.delete(resolved); }

    const invProv = getProvider(invite.provider);
    const invCliBin = findBinary(invite.provider);
    const invLoginEnv: Record<string, string> = { ...process.env as any };
    if (invProv.configDirEnv) invLoginEnv[invProv.configDirEnv] = resolved;

    let proc: import("node:child_process").ChildProcess;
    try {
      proc = spawn(invCliBin, invProv.loginArgs, {
        env: invLoginEnv,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (e: unknown) {
      res.status(500).json({ error: `Failed to spawn ${invProv.binaryName}: ${errorMessage(e)}` });
      return;
    }

    let output = "";
    let responded = false;

    proc.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    proc.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString(); });

    // Handle spawn failure (command not found, permission denied, etc.)
    proc.on("error", (err) => {
      console.error(`[invite-login] spawn error for ${invite.accountName}:`, err.message);
      if (responded) return;
      responded = true;
      clearInterval(pollTimer);
      res.status(500).json({ error: `claude command failed: ${err.message}` });
    });

    proc.on("exit", (exitCode) => {
      console.error(`[invite-login] claude exited (code=${exitCode}) for ${invite.accountName}, output: ${output.slice(0, 300)}`);
      loginProcesses.delete(resolved);
      if (responded) return;
      responded = true;
      clearInterval(pollTimer);
      res.status(500).json({ error: `claude exited with code ${exitCode}`, output: output.slice(0, 500) });
    });

    const pollTimer = setInterval(() => {
      if (responded) return;
      const urlMatch = output.match(/(https:\/\/[^\s]*oauth\/authorize[^\s]+)/);
      if (urlMatch) {
        responded = true;
        clearInterval(pollTimer);
        loginProcesses.set(resolved, { proc, authUrl: urlMatch[1] });
        res.json({ ok: true, authUrl: urlMatch[1] });
      }
    }, 200);

    setTimeout(() => {
      if (responded) return;
      responded = true;
      clearInterval(pollTimer);
      try { proc.kill(); } catch {}
      console.error(`[invite-login] timeout for ${invite.accountName}, output: ${output.slice(0, 300)}`);
      res.status(500).json({ error: "Timeout waiting for auth URL", output: output.slice(0, 500) });
    }, 8000);
  });

  // Complete login via invite link (no auth required) — consumes the invite
  app.post("/api/invite/:code/login/complete", (req, res) => {
    const invite = inviteLinks.get(req.params.code);
    if (!invite || Date.now() > invite.expiresAt) {
      inviteLinks.delete(req.params.code);
      res.status(410).json({ error: "Invite link expired or invalid" });
      return;
    }
    const { code: authCode } = req.body;
    if (!authCode) { res.status(400).json({ error: "Authorization code required" }); return; }
    const resolved = invite.accountPath;
    const entry = loginProcesses.get(resolved);
    if (!entry) { res.status(404).json({ error: "No active login session. Start login first." }); return; }

    entry.proc.stdin?.write(authCode.trim() + "\n");

    let completed = false;
    entry.proc.on("exit", (exitCode) => {
      if (completed) return;
      completed = true;
      loginProcesses.delete(resolved);
      // Consume the invite link (one-time use)
      inviteLinks.delete(req.params.code);
      if (exitCode === 0) {
        res.json({ ok: true, message: "Login successful. This link has been consumed." });
      } else {
        res.json({ ok: false, error: "Login may have failed. Link has been consumed — request a new one if needed." });
      }
    });

    setTimeout(() => {
      if (completed) return;
      completed = true;
      try { entry.proc.kill(); } catch {}
      loginProcesses.delete(resolved);
      // Consume the invite regardless
      inviteLinks.delete(req.params.code);
      if (fs.existsSync(path.join(resolved, ".credentials.json"))) {
        res.json({ ok: true, message: "Login completed. Link consumed." });
      } else {
        res.status(500).json({ error: "Login timed out. Link consumed — request a new one if needed." });
      }
    }, 10000);
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
