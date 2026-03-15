import { Command } from "commander";
import { requireProjectRoot } from "../utils/paths.js";
import { startServer } from "../server/index.js";
import { killPortHolder } from "../server/restart.js";

export const serveCommand = new Command("serve")
  .description("Start the Web UI server")
  .option("--port <port>", "Port number", "8080")
  .option("--restart", "Kill existing server on this port before starting")
  .action((opts: { port: string; restart?: boolean }) => {
    const root = requireProjectRoot();
    const port = parseInt(opts.port, 10);

    if (opts.restart) {
      const killed = killPortHolder(port);
      if (killed) {
        console.log(`Killed previous server on port ${port}`);
      }
    }

    startServer(root, port);
  });

export const restartCommand = new Command("restart")
  .description("Restart the Web UI server (kills existing, then starts)")
  .option("--port <port>", "Port number", "8080")
  .action((opts: { port: string }) => {
    const root = requireProjectRoot();
    const port = parseInt(opts.port, 10);

    const killed = killPortHolder(port);
    if (killed) {
      console.log(`Killed previous server on port ${port}`);
    } else {
      console.log(`No server found on port ${port}`);
    }

    startServer(root, port);
  });
