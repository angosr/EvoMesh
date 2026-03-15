import path from "node:path";
import { Command } from "commander";
import { scaffoldProject } from "../scaffold/init.js";

export const initCommand = new Command("init")
  .description("Initialize a new EvoMesh project")
  .argument("[name]", "Project name", path.basename(process.cwd()))
  .action((name: string) => {
    const root = process.cwd();
    scaffoldProject(root, name);
    console.log(`\n  EvoMesh project "${name}" initialized.`);
    console.log(`\n  Next steps:`);
    console.log(`    evomesh role create lead --from lead`);
    console.log(`    evomesh role create executor --from executor`);
    console.log(`    evomesh start\n`);
  });
