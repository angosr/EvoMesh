import fs from "node:fs";
import path from "node:path";
import { execSync, spawn as cpSpawn } from "node:child_process";
import { spawn as ptySpawn } from "node-pty";
import { roleDir, expandHome, runtimeDir } from "../utils/paths.js";
import { ensureDir } from "../utils/fs.js";
import { writePid, removePid, readPid } from "./registry.js";
import type { ProjectConfig, RoleConfig } from "../config/schema.js";

export interface SpawnedRole {
  role: string;
  pid: number;
  kill: () => void;
}

function tmuxSessionName(roleName: string): string {
  return `evomesh-${roleName}`;
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
    console.error(`Role "${roleName}" is already running (PID ${existing.pid}).`);
    process.exit(1);
  }

  const accountPath = expandHome(config.accounts[roleConfig.account] || "~/.claude");
  const interval = roleConfig.loop_interval || "10m";
  const loopPrompt = `读取 .evomesh/roles/${roleName}/ROLE.md 并按其中的 Loop 执行流程工作。检查 todo.md 和 inbox/。角色目录: .evomesh/roles/${roleName}/`;

  ensureDir(runtimeDir(root));

  if (opts.foreground) {
    return spawnForeground(root, roleName, accountPath, interval, loopPrompt);
  } else {
    return spawnTmux(root, roleName, accountPath, interval, loopPrompt);
  }
}

function spawnForeground(
  root: string,
  roleName: string,
  accountPath: string,
  interval: string,
  loopPrompt: string
): SpawnedRole {
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    CLAUDE_CONFIG_DIR: accountPath,
  };

  const pty = ptySpawn("claude", ["--dangerously-skip-permissions"], {
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

  pty.onData((data) => {
    process.stdout.write(data);
    if (!loopSent) {
      buffer += data;
      if (buffer.includes("bypass permissions")) {
        loopSent = true;
        buffer = "";
        setTimeout(() => {
          pty.write(`/loop ${interval} ${loopPrompt}`);
          setTimeout(() => pty.write("\r"), 500);
        }, 3000);
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
  loopPrompt: string
): SpawnedRole {
  const session = tmuxSessionName(roleName);
  const logPath = path.join(runtimeDir(root), `${roleName}.log`);

  // Kill existing tmux session if any
  try {
    execSync(`tmux kill-session -t ${session} 2>/dev/null`, { stdio: "ignore" });
  } catch {}

  // Clear log
  fs.writeFileSync(logPath, "", "utf-8");

  // Create tmux session running claude
  execSync(
    `tmux new-session -d -s ${session} -x 120 -y 40 ` +
    `"CLAUDE_CONFIG_DIR='${accountPath}' claude --dangerously-skip-permissions"`,
    { cwd: root, stdio: "ignore" }
  );

  // Start logging (pipe-pane captures output to file)
  execSync(`tmux pipe-pane -t ${session} -o 'cat >> ${logPath}'`, { stdio: "ignore" });

  // Get the tmux session's shell PID
  let pid: number;
  try {
    const pidStr = execSync(`tmux list-panes -t ${session} -F '#{pane_pid}'`)
      .toString().trim();
    pid = parseInt(pidStr, 10);
  } catch {
    pid = 0;
  }
  writePid(root, roleName, pid);

  // Schedule /loop command after claude starts up
  // Use tmux send-keys with a delay via a background shell script
  const sendScript = path.join(runtimeDir(root), `${roleName}-send.sh`);
  fs.writeFileSync(sendScript, `#!/bin/bash
sleep 10
tmux send-keys -t ${session} '/loop ${interval} ${loopPrompt.replace(/'/g, "'\\''")}' Enter
`, { mode: 0o755 });

  cpSpawn("bash", [sendScript], {
    detached: true,
    stdio: "ignore",
  }).unref();

  return {
    role: roleName,
    pid,
    kill: () => {
      try {
        execSync(`tmux kill-session -t ${session} 2>/dev/null`, { stdio: "ignore" });
      } catch {}
      removePid(root, roleName);
    },
  };
}

export function stopRole(root: string, roleName: string): boolean {
  const session = tmuxSessionName(roleName);
  const info = readPid(root, roleName);
  if (!info) {
    // Try killing tmux session anyway
    try {
      execSync(`tmux kill-session -t ${session} 2>/dev/null`, { stdio: "ignore" });
    } catch {}
    console.error(`Role "${roleName}" is not running.`);
    return false;
  }
  // Kill tmux session (cleanly kills claude inside)
  try {
    execSync(`tmux kill-session -t ${session} 2>/dev/null`, { stdio: "ignore" });
  } catch {}
  // Also try direct kill as fallback
  if (info.alive) {
    try { process.kill(info.pid, "SIGTERM"); } catch {}
  }
  removePid(root, roleName);
  return true;
}
