import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import express from "express";
import { fileURLToPath } from "node:url";
import { loadWorkspace, slugify, ensureInWorkspace } from "../workspace/config.js";
import { errorMessage } from "../utils/error.js";
import { loadConfig } from "../config/loader.js";
import { isRoleRunning, getContainerPort, getContainerState } from "../process/container.js";
import { roleDir } from "../utils/paths.js";
import { migrateIfNeeded, hasAnyUser, setupAdmin, verifyUser, changePassword, generateSessionToken, listUsers, addUser, deleteUser, resetPassword } from "./auth.js";
import type { SessionInfo, UserRole } from "./auth.js";
import { setupTerminalProxy, ensureTtydRunning } from "./terminal.js";
import { writeRegistry, autoRestartCrashed, cleanupIdleRoles, statsCache, restoreDesiredRoles, markRoleRunning, markRoleStopped } from "./health.js";
import type { TtydProcess } from "./terminal.js";
import { registerRoutes, allocatePort } from "./routes.js";
import { bootstrapGlobalConfig } from "../workspace/bootstrap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ProjectEntry {
  slug: string;
  name: string;
  root: string;
}

export interface ServerContext {
  port: number;
  sessions: Map<string, SessionInfo>;
  ttydProcesses: Map<string, TtydProcess>;
  getProjects: (linuxUser?: string) => ProjectEntry[];
  getProject: (slug: string, linuxUser?: string) => ProjectEntry | undefined;
  checkNeedsLogin: (accountDir: string) => boolean;
  extractToken: (req: { headers: { authorization?: string }; query?: any; url?: string }) => string | undefined;
}

export function startServer(port: number, initialRoot?: string) {
  const app = express();
  const server = http.createServer(app);
  app.use(express.json());

  bootstrapGlobalConfig();
  migrateIfNeeded();

  const sessions = new Map<string, SessionInfo>();
  const SESSION_FILE = path.join(os.homedir(), ".evomesh", "sessions.json");

  // Restore sessions from disk (survive server restart)
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      for (const [token, info] of Object.entries(data)) {
        const s = info as SessionInfo & { createdAt?: string };
        if (s.createdAt && Date.now() - new Date(s.createdAt).getTime() > maxAge) continue;
        sessions.set(token, { username: s.username, role: s.role, linuxUser: s.linuxUser });
      }
      if (sessions.size > 0) console.log(`[auth] Restored ${sessions.size} sessions`);
    }
  } catch (e) { console.error("[sessions] Failed to restore sessions from disk:", e); }

  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  function schedulePersist(): void {
    if (persistTimer) return; // already scheduled
    persistTimer = setTimeout(() => {
      persistTimer = null;
      try {
        const data: Record<string, any> = {};
        for (const [id, s] of sessions) { data[id] = { ...s }; }
        const tmpPath = SESSION_FILE + ".tmp";
        fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
        fs.renameSync(tmpPath, SESSION_FILE);
      } catch (e) { console.error("[sessions] Failed to persist:", e); }
    }, 100); // coalesce writes within 100ms
  }

  // --- Session helpers ---
  function extractToken(req: { headers: { authorization?: string }; query?: any; url?: string }): string | undefined {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
    if (typeof req.query?.token === "string") return req.query.token;
    const url = new URL(req.url || "/", "http://localhost");
    return url.searchParams.get("token") || undefined;
  }

  function getSession(req: { headers: { authorization?: string }; query?: any; url?: string }): SessionInfo | undefined {
    const token = extractToken(req);
    if (!token) return undefined;
    return sessions.get(token);
  }

  // --- Auth routes (no auth required) ---
  app.get("/auth/status", (_req, res) => {
    res.json({ hasUsers: hasAnyUser() });
  });

  app.post("/auth/setup", (req, res) => {
    if (hasAnyUser()) { res.status(400).json({ error: "Admin already exists" }); return; }
    const { username, password } = req.body;
    const name = (username || "admin").trim();
    if (!name || name.length < 2) { res.status(400).json({ error: "Username too short (min 2)" }); return; }
    if (!password || password.length < 8) { res.status(400).json({ error: "Password too short (min 8)" }); return; }
    try {
      setupAdmin(name, password);
      const token = generateSessionToken();
      sessions.set(token, { username: name, role: "admin", linuxUser: process.env.USER || "user" });
      schedulePersist();
      res.json({ ok: true, token, username: name, role: "admin" });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  app.post("/auth/login", (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkLoginRateLimit(ip)) {
      res.status(429).json({ error: "Too many login attempts. Try again in 15 minutes." });
      return;
    }
    const { username, password } = req.body;
    if (!username || !password) { res.status(400).json({ error: "Username and password required" }); return; }
    const user = verifyUser(username, password);
    if (!user) { res.status(401).json({ error: "Invalid username or password" }); return; }
    const token = generateSessionToken();
    sessions.set(token, { username: user.username, role: user.role, linuxUser: user.linuxUser });
    schedulePersist();
    res.json({ ok: true, token, username: user.username, role: user.role });
  });

  app.post("/auth/change-password", (req, res) => {
    const session = getSession(req);
    if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) { res.status(400).json({ error: "New password too short (min 8)" }); return; }
    if (!changePassword(session.username, oldPassword, newPassword)) {
      res.status(401).json({ error: "Wrong current password" }); return;
    }
    res.json({ ok: true });
  });

  app.get("/auth/validate", (req, res) => {
    const session = getSession(req);
    res.json({ valid: !!session, username: session?.username, role: session?.role });
  });

  app.post("/auth/logout", (req, res) => {
    const token = extractToken(req);
    if (token) {
      sessions.delete(token);
      schedulePersist();
    }
    res.json({ ok: true });
  });

  // --- Login rate limiting (brute-force protection) ---
  const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
  const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 min window
  const LOGIN_MAX_ATTEMPTS = 10; // max 10 attempts per window

  function checkLoginRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (!entry || (now - entry.firstAttempt > LOGIN_WINDOW_MS)) {
      loginAttempts.set(ip, { count: 1, firstAttempt: now });
      return true; // allowed
    }
    entry.count++;
    return entry.count <= LOGIN_MAX_ATTEMPTS;
  }
  // --- Auth + role middleware ---
  // Whitelist of paths that don't require auth (exact match or prefix)
  const AUTH_EXEMPT_EXACT = new Set(["/login", "/", "/auth/status", "/auth/setup", "/auth/login"]);
  const AUTH_EXEMPT_PREFIX = ["/auth/", "/terminal/", "/invite/", "/api/invite/"]; // terminal.ts handles its own auth; invite links are self-authenticating

  app.use((req, res, next) => {
    if (AUTH_EXEMPT_EXACT.has(req.path)) return next();
    for (const prefix of AUTH_EXEMPT_PREFIX) {
      if (req.path.startsWith(prefix)) return next();
    }
    // Static assets: only allow exact known extensions on non-API paths
    if (!req.path.startsWith("/api/") && (req.path.endsWith(".css") || req.path.endsWith(".js") || req.path.endsWith(".ico"))) return next();
    const session = getSession(req);
    if (!session) { return res.status(401).json({ error: "Not authenticated" }); }
    (req as any)._session = session;
    next();
  });

  // --- Shared context ---
  const ttydProcesses: Map<string, TtydProcess> = new Map();

  function getProjects(linuxUser?: string): ProjectEntry[] {
    if (initialRoot) ensureInWorkspace(initialRoot);
    const ws = loadWorkspace(linuxUser);
    return ws.projects
      .filter(p => p.active !== false) // treat missing/undefined as active
      .map(p => ({ slug: slugify(p.name), name: p.name, root: path.resolve(p.path) }));
  }

  function getProject(slug: string, linuxUser?: string): ProjectEntry | undefined {
    return getProjects(linuxUser).find(p => p.slug === slug);
  }

  function checkNeedsLogin(accountDir: string): boolean {
    try {
      const dotCreds = path.join(accountDir, ".credentials.json");
      const plainCreds = path.join(accountDir, "credentials.json");
      const credsPath = fs.existsSync(dotCreds) ? dotCreds : plainCreds;
      if (!fs.existsSync(credsPath)) return true;
      const creds = fs.readFileSync(credsPath, "utf-8").trim();
      return !creds || creds === "{}" || creds === "null";
    } catch (e) { console.error("[auth] Failed to check credentials:", e); return true; }
  }

  const ctx: ServerContext = {
    port, sessions, ttydProcesses,
    getProjects, getProject, checkNeedsLogin, extractToken,
  };

  // --- Register terminal proxy and API routes ---
  setupTerminalProxy(server, app, ctx);
  registerRoutes(app, ctx);

  // --- User management (admin only, needs session access) ---
  function requireAdmin(req: any, res: any): SessionInfo | null {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session || session.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return null;
    }
    return session;
  }

  app.get("/api/users", (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json({ users: listUsers() });
  });

  app.post("/api/users", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { username, password, role } = req.body;
    if (!username || !password) { res.status(400).json({ error: "Username and password required" }); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { res.status(400).json({ error: "Username must be alphanumeric (a-z, 0-9, _)" }); return; }
    if (username.length < 2) { res.status(400).json({ error: "Username too short (min 2)" }); return; }
    if (password.length < 8) { res.status(400).json({ error: "Password too short (min 8)" }); return; }
    const userRole: UserRole = role === "admin" ? "admin" : "user";
    try {
      addUser(username.trim(), password, userRole);
      res.json({ ok: true, username: username.trim(), role: userRole });
    } catch (e: unknown) { res.status(409).json({ error: errorMessage(e) }); }
  });

  app.delete("/api/users/:username", (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    const target = req.params.username;
    if (target === session.username) { res.status(400).json({ error: "Cannot delete yourself" }); return; }
    try {
      for (const [token, info] of sessions) {
        if (info.username === target) sessions.delete(token);
      }
      schedulePersist();
      deleteUser(target);
      res.json({ ok: true });
    } catch (e: unknown) { res.status(404).json({ error: errorMessage(e) }); }
  });

  app.post("/api/users/:username/reset-password", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { password } = req.body;
    if (!password || password.length < 8) { res.status(400).json({ error: "Password too short (min 8)" }); return; }
    try {
      resetPassword(req.params.username, password);
      for (const [token, info] of sessions) {
        if (info.username === req.params.username) sessions.delete(token);
      }
      schedulePersist();
      res.json({ ok: true });
    } catch (e: unknown) { res.status(404).json({ error: errorMessage(e) }); }
  });

  // --- Static pages ---
  function resolveAsset(filename: string): string | null {
    const srcPath = path.join(__dirname, "..", "..", "src", "server", filename);
    const distPath = path.join(__dirname, filename);
    if (fs.existsSync(srcPath)) return srcPath;
    if (fs.existsSync(distPath)) return distPath;
    return null;
  }

  app.get("/login", (_req, res) => {
    const p = resolveAsset("login.html");
    if (!p) { res.send("Login page not found."); return; }
    res.type("html").sendFile(path.resolve(p));
  });

  app.get("/app.css", (_req, res) => {
    const p = resolveAsset("frontend.css");
    if (!p) { res.status(404).send("Not found"); return; }
    res.type("css").sendFile(path.resolve(p));
  });

  app.get("/app-mobile.css", (_req, res) => {
    const p = resolveAsset("frontend-mobile.css");
    if (!p) { res.status(404).send("Not found"); return; }
    res.type("css").sendFile(path.resolve(p));
  });

  app.get("/app.js", (_req, res) => {
    const p = resolveAsset("frontend.js");
    if (!p) { res.status(404).send("Not found"); return; }
    res.set("Cache-Control", "no-store");
    res.type("js").sendFile(path.resolve(p));
  });

  app.get("/app-panels.js", (_req, res) => {
    const p = resolveAsset("frontend-panels.js");
    if (!p) { res.status(404).send("Not found"); return; }
    res.set("Cache-Control", "no-store");
    res.type("js").sendFile(path.resolve(p));
  });

  app.get("/app-settings.js", (_req, res) => {
    const p = resolveAsset("frontend-settings.js");
    if (!p) { res.status(404).send("Not found"); return; }
    res.set("Cache-Control", "no-store");
    res.type("js").sendFile(path.resolve(p));
  });

  app.get("/app-feed.js", (_req, res) => {
    const p = resolveAsset("frontend-feed.js");
    if (!p) { res.status(404).send("Not found"); return; }
    res.set("Cache-Control", "no-store");
    res.type("js").sendFile(path.resolve(p));
  });

  app.get("/app-dashboard.js", (_req, res) => {
    const p = resolveAsset("frontend-dashboard.js");
    if (!p) { res.status(404).send("Not found"); return; }
    res.set("Cache-Control", "no-store");
    res.type("js").sendFile(path.resolve(p));
  });

  app.get("/app-actions.js", (_req, res) => {
    const p = resolveAsset("frontend-actions.js");
    if (!p) { res.status(404).send("Not found"); return; }
    res.set("Cache-Control", "no-store");
    res.type("js").sendFile(path.resolve(p));
  });

  app.get("/app-layout.js", (_req, res) => {
    const p = resolveAsset("frontend-layout.js");
    if (!p) { res.status(404).send("Not found"); return; }
    res.set("Cache-Control", "no-store");
    res.type("js").sendFile(path.resolve(p));
  });

  app.get("/", (_req, res) => {
    const p = resolveAsset("frontend.html");
    if (!p) { res.send("Frontend not found."); return; }
    res.type("html").sendFile(path.resolve(p));
  });

  // --- Health monitoring (extracted to health.ts) ---
  (ctx as any).statsCache = statsCache;

  // --- Start ---
  restoreDesiredRoles(ctx);  // Restart roles that were running before server restart
  ensureTtydRunning(ctx);
  setInterval(() => ensureTtydRunning(ctx), 10000);
  writeRegistry(ctx, port);
  setInterval(() => { writeRegistry(ctx, port); autoRestartCrashed(ctx); cleanupIdleRoles(ctx); }, 15000);

  const cleanup = () => {
    // Containers keep running independently — no need to stop them on server exit
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // IMPORTANT: Must bind 0.0.0.0 — remote servers need external access, do not change to 127.0.0.1 (see shared/decisions.md)
  server.listen(port, "0.0.0.0", () => {
    console.log(`\n  EvoMesh Web UI running at:`);
    console.log(`    http://localhost:${port}`);
    console.log(`\n  ${hasAnyUser() ? "Users configured. Login at /login" : "No users. First visitor will create admin account."}\n`);
  });
}
