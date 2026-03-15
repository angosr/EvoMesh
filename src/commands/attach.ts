import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { requireProjectRoot, runtimeDir } from "../utils/paths.js";
import { readPid } from "../process/registry.js";

export const attachCommand = new Command("attach")
  .description("Attach to a running role's output")
  .argument("<role>", "Role name")
  .action((roleName: string) => {
    const root = requireProjectRoot();
    const info = readPid(root, roleName);

    if (!info?.alive) {
      console.error(`Role "${roleName}" is not running. Use \`evomesh start ${roleName} --fg\` to start in foreground.`);
      process.exit(1);
    }

    // Tail the log file
    const logPath = path.join(runtimeDir(root), `${roleName}.log`);
    if (!fs.existsSync(logPath)) {
      console.error(`No log file found for "${roleName}".`);
      process.exit(1);
    }

    console.log(chalk.dim(`--- Attached to ${roleName} (PID ${info.pid}) | Ctrl+C to detach ---\n`));

    // Read existing content
    const existing = fs.readFileSync(logPath, "utf-8");
    if (existing) {
      // Show last 100 lines
      const lines = existing.split("\n");
      const tail = lines.slice(-100).join("\n");
      process.stdout.write(tail);
    }

    // Watch for new content
    const watcher = fs.watch(logPath, () => {
      // Re-read on change (simple approach)
    });

    // Use fs.watchFile for more reliable tailing
    let lastSize = fs.statSync(logPath).size;
    const interval = setInterval(() => {
      try {
        const stat = fs.statSync(logPath);
        if (stat.size > lastSize) {
          const fd = fs.openSync(logPath, "r");
          const buf = Buffer.alloc(stat.size - lastSize);
          fs.readSync(fd, buf, 0, buf.length, lastSize);
          fs.closeSync(fd);
          process.stdout.write(buf);
          lastSize = stat.size;
        }
      } catch {
        // File may be deleted
      }
    }, 200);

    const cleanup = () => {
      clearInterval(interval);
      watcher.close();
      console.log(chalk.dim("\n--- Detached ---"));
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  });
