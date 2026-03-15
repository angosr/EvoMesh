import fs from "node:fs";
import path from "node:path";
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

export function spawnRole(
  root: string,
  roleName: string,
  roleConfig: RoleConfig,
  config: ProjectConfig,
  opts: { foreground?: boolean } = {}
): SpawnedRole {
  // Check if already running
  const existing = readPid(root, roleName);
  if (existing?.alive) {
    console.error(`Role "${roleName}" is already running (PID ${existing.pid}).`);
    process.exit(1);
  }

  // Resolve account path
  const accountPath = expandHome(config.accounts[roleConfig.account] || "~/.claude");

  // Read loop.md
  const loopMdPath = path.join(roleDir(root, roleName), "loop.md");
  if (!fs.existsSync(loopMdPath)) {
    console.error(`loop.md not found for role "${roleName}".`);
    process.exit(1);
  }
  const loopContent = fs.readFileSync(loopMdPath, "utf-8").trim();

  // Parse loop interval
  const interval = roleConfig.loop_interval || "10m";

  // Build the loop prompt: a single-line summary that tells claude to read ROLE.md
  const loopPrompt = `读取 .evomesh/roles/${roleName}/ROLE.md 并按其中的 Loop 执行流程工作。检查 todo.md 和 inbox/。角色目录: .evomesh/roles/${roleName}/`;

  // Claude Code uses cwd for project dir
  // We pass the prompt as argument so claude starts non-interactively
  // Then within the session we invoke /loop
  const args = [
    "--dangerously-skip-permissions",
  ];

  // Spawn via node-pty
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    CLAUDE_CONFIG_DIR: accountPath,
  };

  const pty = ptySpawn("claude", args, {
    name: "xterm-256color",
    cols: 120,
    rows: 40,
    cwd: root,
    env,
  });

  const pid = pty.pid;
  writePid(root, roleName, pid);

  // Wait for claude to be ready, then send /loop command
  let ready = false;
  let outputBuffer = "";

  const onData = (data: string) => {
    outputBuffer += data;
    // Claude Code shows ">" prompt or similar when ready
    // Detect readiness by checking for common ready indicators
    if (!ready && (outputBuffer.includes(">") || outputBuffer.includes("Claude"))) {
      ready = true;
      // Send the /loop command
      setTimeout(() => {
        pty.write(`/loop ${interval} ${loopPrompt}\n`);
      }, 500);
    }
  };
  pty.onData(onData);

  // Log management
  ensureDir(runtimeDir(root));
  const logPath = path.join(runtimeDir(root), `${roleName}.log`);
  // Clear old log
  fs.writeFileSync(logPath, "", "utf-8");
  const logStream = fs.createWriteStream(logPath, { flags: "a" });

  if (opts.foreground) {
    // Pipe PTY to stdout
    pty.onData((data) => {
      process.stdout.write(data);
      logStream.write(data);
    });

    // Pipe stdin to PTY
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on("data", (data) => pty.write(data.toString()));

    // Cleanup on exit
    const cleanup = () => {
      pty.kill();
      removePid(root, roleName);
      logStream.end();
      process.exit(0);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    pty.onExit(() => {
      removePid(root, roleName);
      logStream.end();
      process.exit(0);
    });
  } else {
    // Background: already logging via onData above
    pty.onData((data) => logStream.write(data));

    pty.onExit(() => {
      removePid(root, roleName);
      logStream.end();
    });
  }

  return {
    role: roleName,
    pid,
    kill: () => {
      pty.kill();
      removePid(root, roleName);
    },
  };
}

export function stopRole(root: string, roleName: string): boolean {
  const info = readPid(root, roleName);
  if (!info) {
    console.error(`Role "${roleName}" is not running.`);
    return false;
  }
  if (info.alive) {
    try {
      process.kill(info.pid, "SIGTERM");
    } catch {
      // Process may have already exited
    }
  }
  removePid(root, roleName);
  return true;
}
