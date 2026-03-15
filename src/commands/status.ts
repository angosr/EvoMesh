import { Command } from "commander";
import chalk from "chalk";
import { requireProjectRoot } from "../utils/paths.js";
import { loadConfig } from "../config/loader.js";
import { listRunning, readPid } from "../process/registry.js";

export const statusCommand = new Command("status")
  .description("Show status of all roles")
  .action(() => {
    const root = requireProjectRoot();
    const config = loadConfig(root);
    const roleNames = Object.keys(config.roles);

    if (roleNames.length === 0) {
      console.log("\n  No roles defined.\n");
      return;
    }

    console.log(`\n  Project: ${chalk.bold(config.name)}\n`);

    for (const name of roleNames) {
      const rc = config.roles[name];
      const info = readPid(root, name);
      const alive = info?.alive ?? false;
      const status = alive
        ? `${chalk.green("●")} running (PID ${info!.pid})`
        : `${chalk.red("○")} stopped`;
      const type = rc.type === "lead" ? chalk.yellow("lead") : chalk.blue("worker");
      console.log(`    ${chalk.bold(name)} [${type}] ${rc.loop_interval} — ${status}`);
    }
    console.log();
  });
