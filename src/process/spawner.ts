import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn as cpSpawn } from "node:child_process";
import { spawn as ptySpawn } from "node-pty";
import { roleDir, expandHome, runtimeDir } from "../utils/paths.js";
import { ensureDir } from "../utils/fs.js";
import { slugify } from "../workspace/config.js";
import { writePid, removePid, readPid } from "./registry.js";
import { containerName } from "./container.js";
import type { ProjectConfig, RoleConfig } from "../config/schema.js";

export interface SpawnedRole {
  role: string;
  pid: number;
  kill: () => void;
}

function tmuxSessionName(roleName: string, projectSlug?: string): string {
  const slug = projectSlug || slugify(path.basename(process.cwd()));
  return containerName(slug, roleName);
}

// Strip ANSI escape sequences for readiness detection.
// Cursor-move codes like \x1b[1C act as visual spaces but leave no literal space,
// so we replace them with a space before stripping the rest.
function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\[\d*C/g, " ")           // cursor forward → space
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "") // strip remaining ANSI
    .replace(/ +/g, " ");                   // collapse multiple spaces
}

export function spawnRole(
  root: string,
  roleName: string,
  roleConfig: RoleConfig,
  config: ProjectConfig,
  opts: { foreground?: boolean } = {}
): SpawnedRole {
  const existing = readPid(root, roleName);
  if (existing?.alive) {
    throw new Error(`Role "${roleName}" is already running (PID ${existing.pid}).`);
  }

  const accountPath = expandHome(config.accounts[roleConfig.account] || "~/.claude");
  const interval = roleConfig.loop_interval || "10m";
  const roleRoot = `.evomesh/roles/${roleName}`;
  const projectSlug = slugify(path.basename(root));
  const loopPrompt = `你是 ${roleName} 角色。执行 ${roleRoot}/ROLE.md 工作目录: ${roleRoot}/`;

  // Check for saved session ID to resume
  const sessionFile = path.join(root, roleRoot, ".session-id");
  let savedSessionId = "";
  try { savedSessionId = fs.readFileSync(sessionFile, "utf-8").trim(); } catch {}

  const claudeArgs = savedSessionId
    ? ["--resume", savedSessionId, "--dangerously-skip-permissions"]
    : ["--name", roleName, "--dangerously-skip-permissions"];

  ensureDir(runtimeDir(root));

  if (opts.foreground) {
    return spawnForeground(root, roleName, accountPath, interval, loopPrompt, claudeArgs);
  } else {
    return spawnTmux(root, roleName, accountPath, interval, loopPrompt, claudeArgs);
  }
}

function spawnForeground(
  root: string,
  roleName: string,
  accountPath: string,
  interval: string,
  loopPrompt: string,
  claudeArgs: string[] = ["--dangerously-skip-permissions"]
): SpawnedRole {
  // Only set CLAUDE_CONFIG_DIR for non-default accounts. When set explicitly
  // (even to ~/.claude), Claude Code uses a different internal state file path,
  // causing it to miss existing auth state and prompt for login.
  const defaultAccount = path.join(process.env.HOME || "/home", ".claude");
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...(accountPath !== defaultAccount ? { CLAUDE_CONFIG_DIR: accountPath } : {}),
  };

  const pty = ptySpawn("claude", claudeArgs, {
    name: "xterm-256color",
    cols: 120,
    rows: 40,
    cwd: root,
    env,
  });

  const pid = pty.pid;
  writePid(root, roleName, pid);

  let loopSent = false;
  let buffer = "";
  let readyDetected = false;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  const sendLoop = () => {
    loopSent = true;
    buffer = "";
    pty.write(`/loop ${interval} ${loopPrompt}`);
    setTimeout(() => pty.write("\r"), 500);
  };

  pty.onData((data) => {
    process.stdout.write(data);
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

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.on("data", (data) => pty.write(data.toString()));

  const cleanup = () => {
    pty.kill();
    removePid(root, roleName);
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  pty.onExit(() => {
    removePid(root, roleName);
    process.exit(0);
  });

  return { role: roleName, pid, kill: () => { pty.kill(); removePid(root, roleName); } };
}

function spawnTmux(
  root: string,
  roleName: string,
  accountPath: string,
  interval: string,
  loopPrompt: string,
  claudeArgs: string[] = ["--name", roleName, "--dangerously-skip-permissions"]
): SpawnedRole {
  const projectSlug = slugify(path.basename(root));
  const session = tmuxSessionName(roleName, projectSlug);
  const logPath = path.join(runtimeDir(root), `${roleName}.log`);

  // Kill existing tmux session if any
  try {
    execFileSync("tmux", ["kill-session", "-t", session], { stdio: "ignore" });
  } catch {}

  // Clear log
  fs.writeFileSync(logPath, "", "utf-8");

  // Create tmux session running claude
  // Only set CLAUDE_CONFIG_DIR for non-default accounts (see routes-admin.ts comment)
  const defaultAccount = path.join(process.env.HOME || "/home", ".claude");
  const tmuxCmd = accountPath !== defaultAccount
    ? ["env", `CLAUDE_CONFIG_DIR=${accountPath}`, "claude", ...claudeArgs]
    : ["claude", ...claudeArgs];
  execFileSync("tmux", [
    "new-session", "-d", "-s", session, "-x", "120", "-y", "40",
    ...tmuxCmd,
  ], { cwd: root, stdio: "ignore" });

  // Mouse off: allows native text selection in web terminal
  // Mobile touch scrolling handled by API-based scroll endpoint instead
  try { execFileSync("tmux", ["set-option", "-t", session, "mouse", "off"], { stdio: "ignore" }); } catch {}

  // Start logging (pipe-pane captures output to file)
  // pipe-pane -o passes its argument to the shell, so logPath must be quoted
  const quotedLogPath = `'${logPath.replace(/'/g, "'\\''")}'`;
  execFileSync("tmux", ["pipe-pane", "-t", session, "-o", `cat >> ${quotedLogPath}`], { stdio: "ignore" });

  // Get the tmux session's shell PID
  let pid: number;
  try {
    const pidStr = execFileSync("tmux", ["list-panes", "-t", session, "-F", "#{pane_pid}"])
      .toString().trim();
    pid = parseInt(pidStr, 10);
  } catch {
    pid = 0;
  }
  writePid(root, roleName, pid);

  // Schedule /loop command after claude is ready
  // Poll log file for readiness indicator, then wait for output to settle
  // Variables are passed via env to avoid shell injection in the script body
  const loopCmd = `/loop ${interval} ${loopPrompt}`;
  const sendScript = path.join(runtimeDir(root), `${roleName}-send.sh`);
  fs.writeFileSync(sendScript, `#!/bin/bash
# Poll log until "bypass" + "permissions" appears (max 60s)
# Log contains ANSI escape codes (cursor-move separates words), so match each word
ESC=$(printf '\\x1b')
for i in $(seq 1 120); do
  if grep -q "bypass" "$EVOMESH_LOG" 2>/dev/null && grep -q "permissions" "$EVOMESH_LOG" 2>/dev/null; then
    # Wait for output to settle (no log growth for 1.5s)
    prev_size=0
    while true; do
      curr_size=$(wc -c < "$EVOMESH_LOG" 2>/dev/null || echo 0)
      if [ "$curr_size" = "$prev_size" ] && [ "$curr_size" -gt 0 ]; then
        break
      fi
      prev_size=$curr_size
      sleep 1.5
    done
    tmux send-keys -t "$EVOMESH_SESSION" "$EVOMESH_LOOP_CMD" Enter
    # Save session ID for future --resume
    sleep 5
    if [ -f "$EVOMESH_ACCOUNT/history.jsonl" ]; then
      SID=$(tail -1 "$EVOMESH_ACCOUNT/history.jsonl" | grep -o '"sessionId":"[^"]*"' | head -1 | cut -d'"' -f4)
      [ -n "$SID" ] && echo "$SID" > "$EVOMESH_SESSION_FILE"
    fi
    exit 0
  fi
  sleep 0.5
done
echo "[evomesh] Timed out waiting for Claude readiness" >> "$EVOMESH_LOG"
`, { mode: 0o755 });

  cpSpawn("bash", [sendScript], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      EVOMESH_LOG: logPath,
      EVOMESH_SESSION: session,
      EVOMESH_LOOP_CMD: loopCmd,
      EVOMESH_ACCOUNT: accountPath,
      EVOMESH_SESSION_FILE: path.join(root, `.evomesh/roles/${roleName}/.session-id`),
    },
  }).unref();

  return {
    role: roleName,
    pid,
    kill: () => {
      try {
        execFileSync("tmux", ["kill-session", "-t", session], { stdio: "ignore" });
      } catch {}
      removePid(root, roleName);
    },
  };
}

export function stopRole(root: string, roleName: string): boolean {
  const projectSlug = slugify(path.basename(root));
  const session = tmuxSessionName(roleName, projectSlug);
  const info = readPid(root, roleName);
  if (!info) {
    // Try killing tmux session anyway
    try {
      execFileSync("tmux", ["kill-session", "-t", session], { stdio: "ignore" });
    } catch {}
    console.error(`Role "${roleName}" is not running.`);
    return false;
  }
  // Kill tmux session (cleanly kills claude inside)
  try {
    execFileSync("tmux", ["kill-session", "-t", session], { stdio: "ignore" });
  } catch {}
  // Also try direct kill as fallback
  if (info.alive) {
    try { process.kill(info.pid, "SIGTERM"); } catch {}
  }
  removePid(root, roleName);
  return true;
}
