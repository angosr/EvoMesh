import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { loadConfig } from "../config/loader.js";
import { roleDir } from "../utils/paths.js";
import { isRoleRunning } from "../process/container.js";
import { errorMessage } from "../utils/error.js";
import { requireProjectRole, reqLinuxUser } from "./routes.js";
import type { SessionInfo } from "./auth.js";
import type { ServerContext } from "./index.js";

/**
 * Extract meaningful text from short-term.md for the feed.
 * Returns null if content is pure bookkeeping (no real info to show).
 */
function extractFeedText(stm: string): string | null {
  const NOISE = /^No new inbox|^No tasks|^Nothing new|^updated$|^Idle|^idle|^Check inbox|^Await/i;

  // Try **Done**: pattern first (most roles use this)
  const doneMatch = stm.match(/^\s*-\s*\*\*Done\*\*:\s*(.+)$/m);
  if (doneMatch) {
    const done = doneMatch[1].trim();
    if (NOISE.test(done)) return null;
    return done;
  }

  // Try ## Done section — collect all bullets under it
  const doneSection = stm.match(/^## Done\n([\s\S]*?)(?=\n## |\n$|$)/m);
  if (doneSection) {
    const bullets = doneSection[1].match(/^[-*]\s+(.+)$/gm);
    if (bullets && bullets.length > 0) {
      const meaningful = bullets
        .map(b => b.replace(/^[-*]\s+/, ""))
        .filter(b => !NOISE.test(b));
      if (meaningful.length > 0) return meaningful.join("; ");
    }
  }

  // Fallback: first meaningful bullet point
  const allBullets = stm.match(/^[-*]\s+(.+)$/gm);
  if (allBullets) {
    for (const b of allBullets) {
      const text = b.replace(/^[-*]\s+/, "").replace(/\*\*[^*]+\*\*:\s*/, ""); // strip **Label**:
      if (text.length > 10 && !NOISE.test(text) && !/^Next|^In-progress/i.test(text)) {
        return text;
      }
    }
  }

  return null;
}

export function registerFeedRoutes(app: import("express").Express, ctx: ServerContext): void {

  // --- Mission Control: aggregated role data ---
  app.get("/api/mission-control", (req, res) => {
    const firstProject = ctx.getProjects(reqLinuxUser(req))[0];
    if (!firstProject) { res.json({ activity: [], issues: [], tasks: [], ts: new Date().toISOString() }); return; }
    if (!requireProjectRole(req, res, firstProject.root, "viewer")) return;
    try {
      const now = Date.now();
      const relTime = (ms: number) => {
        const m = Math.floor(ms / 60000);
        if (m < 1) return "just now";
        if (m < 60) return `${m}min ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
      };
      const projects = ctx.getProjects();
      const activity: Array<{ project: string; role: string; time: string; text: string; mtime: number }> = [];
      const issues: Array<{ project: string; slug: string; role: string; type: string; title: string; meta: string }> = [];
      const tasks: Array<{ priority: string; text: string; project: string; role: string; done: boolean }> = [];

      for (const p of projects) {
        let config;
        try { config = loadConfig(p.root); } catch (e: unknown) { console.error(`[feed] failed to load config for ${p.root}: ${errorMessage(e)}`); continue; }

        for (const [name] of Object.entries(config.roles)) {
          const rDir = roleDir(p.root, name);
          const running = isRoleRunning(p.root, name);

          // Only show activity for running roles
          if (!running) {
            issues.push({ project: p.name, slug: p.slug, role: name, type: "stopped", title: `${name} stopped`, meta: p.name });
            continue;
          }

          const stmPath = path.join(rDir, "memory", "short-term.md");
          try {
            const stat = fs.statSync(stmPath);
            const stm = fs.readFileSync(stmPath, "utf-8");
            const ageMs = now - stat.mtimeMs;
            const feedText = extractFeedText(stm);
            if (feedText) {
              activity.push({ project: p.name, role: name, time: relTime(ageMs), text: feedText, mtime: stat.mtimeMs });
            }
            if (ageMs > 3600000) {
              issues.push({ project: p.name, slug: p.slug, role: name, type: "stale", title: `${name} memory stale`, meta: `${p.name} — ${relTime(ageMs)} outdated` });
            }
          } catch (e: unknown) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") console.error(`[feed] error reading STM for ${name}: ${errorMessage(e)}`); }

          try {
            const todo = fs.readFileSync(path.join(rDir, "todo.md"), "utf-8");
            let currentPriority = "P?";
            for (const line of todo.split("\n")) {
              const headerMatch = line.match(/^## (P\d)/);
              if (headerMatch) { currentPriority = headerMatch[1]; continue; }
              const taskMatch = line.match(/^[-*]\s+(.+)/);
              if (!taskMatch) continue;
              const text = taskMatch[1];
              const done = text.startsWith("~~") || text.includes("✅");
              if (currentPriority === "P0" && !done) {
                issues.push({ project: p.name, slug: p.slug, role: name, type: "p0-pending", title: `${name} has P0 task`, meta: text.slice(0, 80) });
              }
              if (!done) tasks.push({ priority: currentPriority, text: text.slice(0, 120), project: p.name, role: name, done });
            }
          } catch (e: unknown) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") console.error(`[feed] error reading todo for ${name}: ${errorMessage(e)}`); }
        }
      }

      activity.sort((a, b) => b.mtime - a.mtime);
      tasks.sort((a, b) => a.priority.localeCompare(b.priority));
      res.json({ activity: activity.map(({ mtime, ...a }) => a), issues, tasks, ts: new Date().toISOString() });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  // --- SSE Feed: real-time role updates ---
  const feedSubscribers: Set<import("express").Response> = new Set();
  (ctx as any)._feedSubscribers = feedSubscribers;
  const FEED_FILE = path.join(os.homedir(), ".evomesh", "feed.jsonl");
  const FEED_MAX_LINES = 500;

  let feedTruncating = false;
  function appendFeedLine(msg: Record<string, unknown>) {
    const line = JSON.stringify({ ...msg, time: msg.time || new Date().toISOString() });
    try {
      fs.appendFileSync(FEED_FILE, line + "\n");
    } catch (e: unknown) {
      console.error(`[feed] failed to append to feed file: ${errorMessage(e)}`);
      return;
    }
    if (feedTruncating) return;
    try {
      const content = fs.readFileSync(FEED_FILE, "utf-8");
      const lines = content.trim().split("\n");
      if (lines.length > FEED_MAX_LINES) {
        feedTruncating = true;
        try {
          fs.writeFileSync(FEED_FILE, lines.slice(-250).join("\n") + "\n");
        } finally {
          feedTruncating = false;
        }
      }
    } catch (e: unknown) {
      console.error(`[feed] failed to truncate feed file: ${errorMessage(e)}`);
    }
  }

  function broadcastFeed(msg: Record<string, unknown>) {
    appendFeedLine(msg);
    const data = `data: ${JSON.stringify(msg)}\n\n`;
    for (const sub of feedSubscribers) { try { sub.write(data); } catch (e: unknown) { console.error(`[feed] failed to write to SSE subscriber: ${errorMessage(e)}`); } }
  }
  (ctx as any)._broadcastFeed = broadcastFeed;

  app.get("/api/feed/stream", (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Send history first
    try {
      if (fs.existsSync(FEED_FILE)) {
        const lines = fs.readFileSync(FEED_FILE, "utf-8").trim().split("\n").slice(-50);
        for (const line of lines) {
          if (line.trim()) res.write(`data: ${line}\n\n`);
        }
      }
    } catch (e: unknown) { console.error(`[feed] failed to send SSE history: ${errorMessage(e)}`); }

    const lastMtime = new Map<string, number>();
    const lastText = new Map<string, string>(); // dedup: skip if same text as last broadcast

    const check = () => {
      try {
        const projects = ctx.getProjects();
        const activeKeys = new Set<string>();
        for (const p of projects) {
          let config;
          try { config = loadConfig(p.root); } catch { continue; }
          for (const [name] of Object.entries(config.roles)) {
            // Skip stopped roles — don't broadcast stale updates
            if (!isRoleRunning(p.root, name)) continue;
            const key = `${p.slug}/${name}`;
            activeKeys.add(key);
            const stmPath = path.join(roleDir(p.root, name), "memory", "short-term.md");
            if (!fs.existsSync(stmPath)) continue;
            try {
              const stat = fs.statSync(stmPath);
              const prevMtime = lastMtime.get(key) || 0;
              if (stat.mtimeMs > prevMtime) {
                lastMtime.set(key, stat.mtimeMs);
                const stm = fs.readFileSync(stmPath, "utf-8");
                const text = extractFeedText(stm);
                // Only broadcast if meaningful AND different from last broadcast for this role
                if (text && text !== lastText.get(key)) {
                  lastText.set(key, text);
                  broadcastFeed({ type: "role", role: name, project: p.slug, text: text.slice(0, 200) });
                }
              }
            } catch (e: unknown) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") console.error(`[feed] error checking STM for ${name}: ${errorMessage(e)}`); }
          }
        }
        // Clean up maps for roles that no longer exist
        activeKeys.add("central");
        for (const key of lastMtime.keys()) {
          if (!activeKeys.has(key)) { lastMtime.delete(key); lastText.delete(key); }
        }
        try {
          const statusPath = path.join(os.homedir(), ".evomesh", "central", "central-status.md");
          const stat = fs.statSync(statusPath);
          const prevMtime = lastMtime.get("central") || 0;
          if (stat.mtimeMs > prevMtime) {
            lastMtime.set("central", stat.mtimeMs);
            if (prevMtime > 0) {
              const status = fs.readFileSync(statusPath, "utf-8");
              const lines = status.split('\n').filter(l => l.trim() && !l.startsWith('```'));
              if (lines.length && /^# [^#]/.test(lines[0])) lines.shift();
              const summary = lines.slice(0, 12).join('\n');
              broadcastFeed({ type: "central", text: summary });
            }
          }
        } catch (e: unknown) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") console.error(`[feed] error checking central status: ${errorMessage(e)}`); }
      } catch (e: unknown) { console.error(`[feed] error in SSE check loop: ${errorMessage(e)}`); }
    };

    feedSubscribers.add(res);
    check();
    const timer = setInterval(check, 5000);
    const maxLifetime = setTimeout(() => { clearInterval(timer); feedSubscribers.delete(res); res.end(); }, 30 * 60 * 1000);
    req.on("close", () => { clearInterval(timer); clearTimeout(maxLifetime); feedSubscribers.delete(res); });
  });
}
