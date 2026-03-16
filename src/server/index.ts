import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import express from "express";
import { fileURLToPath } from "node:url";
import { loadWorkspace, slugify, ensureInWorkspace } from "../workspace/config.js";
import { migrateIfNeeded, hasAnyUser, setupAdmin, verifyUser, changePassword, generateSessionToken, listUsers, addUser, deleteUser, resetPassword } from "./auth.js";
import type { SessionInfo, UserRole } from "./auth.js";
import { setupTerminalProxy, ensureTtydRunning } from "./terminal.js";
import type { TtydProcess } from "./terminal.js";
import { registerRoutes } from "./routes.js";

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
  getProjects: () => ProjectEntry[];
  getProject: (slug: string) => ProjectEntry | undefined;
  checkNeedsLogin: (accountDir: string) => boolean;
  extractToken: (req: { headers: { authorization?: string }; query?: any; url?: string }) => string | undefined;
}

export function startServer(port: number, initialRoot?: string) {
  const app = express();
  const server = http.createServer(app);
  app.use(express.json());

  migrateIfNeeded();

  const sessions = new Map<string, SessionInfo>();

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
    if (!password || password.length < 4) { res.status(400).json({ error: "Password too short (min 4)" }); return; }
    try {
      setupAdmin(name, password);
      const token = generateSessionToken();
      sessions.set(token, { username: name, role: "admin" });
      res.json({ ok: true, token, username: name, role: "admin" });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) { res.status(400).json({ error: "Username and password required" }); return; }
    const user = verifyUser(username, password);
    if (!user) { res.status(401).json({ error: "Invalid username or password" }); return; }
    const token = generateSessionToken();
    sessions.set(token, { username: user.username, role: user.role });
    res.json({ ok: true, token, username: user.username, role: user.role });
  });

  app.post("/auth/change-password", (req, res) => {
    const session = getSession(req);
    if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) { res.status(400).json({ error: "New password too short" }); return; }
    if (!changePassword(session.username, oldPassword, newPassword)) {
      res.status(401).json({ error: "Wrong current password" }); return;
    }
    res.json({ ok: true });
  });

  app.get("/auth/validate", (req, res) => {
    const session = getSession(req);
    res.json({ valid: !!session, username: session?.username, role: session?.role });
  });

  // --- Auth + role middleware ---
  app.use((req, res, next) => {
    if (req.path.startsWith("/auth/")) return next();
    if (req.path === "/login" || req.path === "/") return next();
    // Allow static assets (CSS, JS) without auth
    if (req.path.endsWith(".css") || req.path.endsWith(".js") || req.path.endsWith(".ico")) return next();
    // Terminal proxy handles its own auth via token query param
    if (req.path.startsWith("/terminal/")) return next();
    const session = getSession(req);
    if (!session) { return res.status(401).json({ error: "Not authenticated" }); }
    (req as any)._session = session;
    next();
  });

  // --- Shared context ---
  const ttydProcesses: Map<string, TtydProcess> = new Map();

  function getProjects(): ProjectEntry[] {
    if (initialRoot) ensureInWorkspace(initialRoot);
    const ws = loadWorkspace();
    return ws.projects
      .filter(p => p.active)
      .map(p => ({ slug: slugify(p.name), name: p.name, root: path.resolve(p.path) }));
  }

  function getProject(slug: string): ProjectEntry | undefined {
    return getProjects().find(p => p.slug === slug);
  }

  function checkNeedsLogin(accountDir: string): boolean {
    try {
      const dotCreds = path.join(accountDir, ".credentials.json");
      const plainCreds = path.join(accountDir, "credentials.json");
      const credsPath = fs.existsSync(dotCreds) ? dotCreds : plainCreds;
      if (!fs.existsSync(credsPath)) return true;
      const creds = fs.readFileSync(credsPath, "utf-8").trim();
      return !creds || creds === "{}" || creds === "null";
    } catch { return true; }
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
    if (username.length < 2) { res.status(400).json({ error: "Username too short (min 2)" }); return; }
    if (password.length < 4) { res.status(400).json({ error: "Password too short (min 4)" }); return; }
    const userRole: UserRole = role === "admin" ? "admin" : "user";
    try {
      addUser(username.trim(), password, userRole);
      res.json({ ok: true, username: username.trim(), role: userRole });
    } catch (e: any) { res.status(409).json({ error: e.message }); }
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
      deleteUser(target);
      res.json({ ok: true });
    } catch (e: any) { res.status(404).json({ error: e.message }); }
  });

  app.post("/api/users/:username/reset-password", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { password } = req.body;
    if (!password || password.length < 4) { res.status(400).json({ error: "Password too short (min 4)" }); return; }
    try {
      resetPassword(req.params.username, password);
      for (const [token, info] of sessions) {
        if (info.username === req.params.username) sessions.delete(token);
      }
      res.json({ ok: true });
    } catch (e: any) { res.status(404).json({ error: e.message }); }
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

  app.get("/", (_req, res) => {
    const p = resolveAsset("frontend.html");
    if (!p) { res.send("Frontend not found."); return; }
    res.type("html").sendFile(path.resolve(p));
  });

  // --- Start ---
  ensureTtydRunning(ctx);
  setInterval(() => ensureTtydRunning(ctx), 10000);

  const cleanup = () => {
    // Containers keep running independently — no need to stop them on server exit
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // IMPORTANT: 必须 0.0.0.0 — 远程服务器需外网访问，勿改为 127.0.0.1（见 shared/decisions.md）
  server.listen(port, "0.0.0.0", () => {
    console.log(`\n  EvoMesh Web UI running at:`);
    console.log(`    http://localhost:${port}`);
    console.log(`\n  ${hasAnyUser() ? "Users configured. Login at /login" : "No users. First visitor will create admin account."}\n`);
  });
}
