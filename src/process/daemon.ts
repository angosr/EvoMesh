/**
 * Daemon process that holds PTY handles for background roles.
 *
 * This file is executed as a detached child process by the start command.
 * It receives role configuration via argv, spawns claude code via node-pty,
 * and stays alive to hold the PTY handle.
 *
 * Usage: tsx daemon.ts <root> <roleName> <accountPath> <interval> <loopPrompt>
 */
import fs from "node:fs";
import path from "node:path";
import { spawn as ptySpawn } from "node-pty";

const [, , root, roleName, accountPath, interval, loopPrompt] = process.argv;

if (!root || !roleName || !accountPath || !interval || !loopPrompt) {
  console.error("Usage: daemon.ts <root> <roleName> <accountPath> <interval> <loopPrompt>");
  process.exit(1);
}

const runtimeDir = path.join(root, ".evomesh", "runtime");
const logPath = path.join(runtimeDir, `${roleName}.log`);
const pidFile = path.join(runtimeDir, `${roleName}.pid`);

// Clear old log
fs.writeFileSync(logPath, "", "utf-8");
const logStream = fs.createWriteStream(logPath, { flags: "a" });

const env: Record<string, string> = {
  ...process.env as Record<string, string>,
  CLAUDE_CONFIG_DIR: accountPath,
};

const pty = ptySpawn("claude", ["--resume", roleName, "--name", roleName, "--dangerously-skip-permissions"], {
  name: "xterm-256color",
  cols: 120,
  rows: 40,
  cwd: root,
  env,
});

// Write daemon's own PID (not the pty child pid) — we need the PTY pid for killing
fs.writeFileSync(pidFile, String(process.pid), "utf-8");

function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\[\d*C/g, " ")
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/ +/g, " ");
}

// Readiness detection + /loop injection
let loopSent = false;
let buffer = "";
let readyDetected = false;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

const sendLoop = () => {
  loopSent = true;
  buffer = "";
  const cmd = `/loop ${interval} ${loopPrompt}`;
  pty.write(cmd);
  setTimeout(() => pty.write("\r"), 500);
};

pty.onData((data) => {
  logStream.write(data);

  if (!loopSent) {
    buffer += data;
    if (!readyDetected && stripAnsi(buffer).includes("bypass permissions")) {
      readyDetected = true;
    }
    if (readyDetected) {
      // Debounce: wait for output to settle (no new data for 1.5s)
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(sendLoop, 1500);
    }
  }
});

pty.onExit(({ exitCode }) => {
  logStream.write(`\n[evomesh] Claude Code exited with code ${exitCode}\n`);
  logStream.end();
  // Clean up PID file
  try { fs.unlinkSync(pidFile); } catch {}
  process.exit(exitCode);
});

// Handle signals
const cleanup = () => {
  pty.kill();
  try { fs.unlinkSync(pidFile); } catch {}
  logStream.end();
  process.exit(0);
};
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);

// Keep process alive
process.stdin.resume();
