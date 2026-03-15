import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { roleCommand } from "./commands/role.js";
import { startCommand } from "./commands/start.js";
import { stopCommand } from "./commands/stop.js";
import { statusCommand } from "./commands/status.js";
import { attachCommand } from "./commands/attach.js";
import { serveCommand } from "./commands/serve.js";

const program = new Command("evomesh")
  .version("0.1.0")
  .description("Self-evolving multi-role orchestrator for Claude Code");

program.addCommand(initCommand);
program.addCommand(roleCommand);
program.addCommand(startCommand);
program.addCommand(stopCommand);
program.addCommand(statusCommand);
program.addCommand(attachCommand);
program.addCommand(serveCommand);

program.parse(process.argv);
