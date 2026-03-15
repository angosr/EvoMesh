import { Command } from "commander";
import { findProjectRoot } from "../utils/paths.js";
import { startServer } from "../server/index.js";
import { killPortHolder } from "../server/restart.js";

export const serveCommand = new Command("serve")
  .description("Start the Web UI server")
  .option("--port <port>", "Port number", "8080")
  .option("--token <token>", "Bearer token for authentication (auto-generated if omitted)")
  .option("--restart", "Kill existing server on this port before starting")
  .action((opts: { port: string; token?: string; restart?: boolean }) => {
    const port = parseInt(opts.port, 10);
    const root = findProjectRoot() || undefined;

    if (opts.restart) {
      const killed = killPortHolder(port);
      if (killed) console.log(`Killed previous server on port ${port}`);
    }

    startServer(port, root, opts.token);
  });

export const restartCommand = new Command("restart")
  .description("Restart the Web UI server (kills existing, then starts)")
  .option("--port <port>", "Port number", "8080")
  .option("--token <token>", "Bearer token for authentication (auto-generated if omitted)")
  .action((opts: { port: string; token?: string }) => {
    const port = parseInt(opts.port, 10);
    const root = findProjectRoot() || undefined;

    const killed = killPortHolder(port);
    if (killed) console.log(`Killed previous server on port ${port}`);
    else console.log(`No server found on port ${port}`);

    startServer(port, root, opts.token);
  });
