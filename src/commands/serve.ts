import { Command } from "commander";

export const serveCommand = new Command("serve")
  .description("Start the Web UI server (Phase 3)")
  .option("--port <port>", "Port number", "8080")
  .action((opts: { port: string }) => {
    console.log(`\n  Web UI server is planned for Phase 3.`);
    console.log(`  For now, use the CLI commands:\n`);
    console.log(`    evomesh start [role]     Start roles`);
    console.log(`    evomesh start <role> --fg   Start in foreground`);
    console.log(`    evomesh attach <role>    Attach to running role`);
    console.log(`    evomesh status           View role status\n`);
  });
