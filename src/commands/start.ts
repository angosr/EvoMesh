import { Command } from "commander";
import chalk from "chalk";
import { requireProjectRoot } from "../utils/paths.js";
import { loadConfig } from "../config/loader.js";
import { spawnRole } from "../process/spawner.js";

export const startCommand = new Command("start")
  .description("Start roles")
  .argument("[role]", "Role name (omit to start all)")
  .option("--account <account>", "Override account for this run")
  .option("--fg", "Run in foreground (single role only)")
  .action((roleName: string | undefined, opts: { account?: string; fg?: boolean }) => {
    const root = requireProjectRoot();
    const config = loadConfig(root);
    const roleNames = roleName ? [roleName] : Object.keys(config.roles);

    if (roleNames.length === 0) {
      console.error("No roles defined. Use `evomesh role create` first.");
      process.exit(1);
    }

    if (opts.fg && roleNames.length > 1) {
      console.error("--fg can only be used with a single role.");
      process.exit(1);
    }

    for (const name of roleNames) {
      const rc = config.roles[name];
      if (!rc) {
        console.error(`Role "${name}" not found in project.yaml.`);
        process.exit(1);
      }

      if (opts.account) {
        rc.account = opts.account;
      }

      const foreground = opts.fg && roleNames.length === 1;
      const spawned = spawnRole(root, name, rc, config, { foreground });

      if (!foreground) {
        console.log(
          `  ${chalk.green("●")} ${chalk.bold(name)} started (PID ${spawned.pid}, ${rc.loop_interval})`
        );
      }
    }

    if (!opts.fg) {
      console.log(`\n  Use ${chalk.cyan("evomesh status")} to check running roles.`);
      console.log(`  Use ${chalk.cyan("evomesh attach <role>")} to view a role's terminal.\n`);
    }
  });
