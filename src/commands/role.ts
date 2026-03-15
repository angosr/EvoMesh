import { Command } from "commander";
import chalk from "chalk";
import { requireProjectRoot } from "../utils/paths.js";
import { loadConfig } from "../config/loader.js";
import { createRole, deleteRole, listRoles } from "../roles/manager.js";
import { TEMPLATE_NAMES } from "../roles/templates/index.js";

export const roleCommand = new Command("role").description("Manage roles");

roleCommand
  .command("create")
  .description("Create a new role")
  .argument("<name>", "Role name")
  .requiredOption("--from <template>", `Template (${TEMPLATE_NAMES.join(", ")})`)
  .option("--account <account>", "Account name from project.yaml", "main")
  .action((name: string, opts: { from: string; account: string }) => {
    const root = requireProjectRoot();
    const config = loadConfig(root);
    createRole(root, name, opts.from, config, opts.account);
    console.log(`\n  Role "${name}" created from template "${opts.from}".`);
    console.log(`  Directory: .evomesh/roles/${name}/\n`);
  });

roleCommand
  .command("list")
  .description("List all roles")
  .action(() => {
    const root = requireProjectRoot();
    const config = loadConfig(root);
    const roles = listRoles(root);

    if (roles.length === 0) {
      console.log("\n  No roles defined. Use `evomesh role create` to add one.\n");
      return;
    }

    console.log("\n  Roles:\n");
    for (const name of roles) {
      const rc = config.roles[name];
      const type = rc?.type === "lead" ? chalk.yellow("lead") : chalk.blue("worker");
      const interval = rc?.loop_interval || "?";
      const desc = rc?.description || "";
      console.log(`    ${chalk.bold(name)} [${type}] ${interval} — ${desc}`);
    }
    console.log();
  });

roleCommand
  .command("delete")
  .description("Delete a role")
  .argument("<name>", "Role name")
  .action((name: string) => {
    const root = requireProjectRoot();
    const config = loadConfig(root);
    deleteRole(root, name, config);
    console.log(`\n  Role "${name}" deleted.\n`);
  });
