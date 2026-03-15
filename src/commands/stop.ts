import { Command } from "commander";
import chalk from "chalk";
import { requireProjectRoot } from "../utils/paths.js";
import { loadConfig } from "../config/loader.js";
import { stopRole } from "../process/spawner.js";
import { listRunning } from "../process/registry.js";

export const stopCommand = new Command("stop")
  .description("Stop roles")
  .argument("[role]", "Role name (omit to stop all)")
  .action((roleName: string | undefined) => {
    const root = requireProjectRoot();

    if (roleName) {
      if (stopRole(root, roleName)) {
        console.log(`  ${chalk.red("○")} ${chalk.bold(roleName)} stopped.`);
      }
    } else {
      const running = listRunning(root);
      if (running.length === 0) {
        console.log("  No roles running.");
        return;
      }
      for (const info of running) {
        if (stopRole(root, info.role)) {
          console.log(`  ${chalk.red("○")} ${chalk.bold(info.role)} stopped.`);
        }
      }
    }
  });
