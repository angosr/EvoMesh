import { Command } from "commander";
import { requireProjectRoot } from "../utils/paths.js";
import { startServer } from "../server/index.js";

export const serveCommand = new Command("serve")
  .description("Start the Web UI server")
  .option("--port <port>", "Port number", "8080")
  .action((opts: { port: string }) => {
    const root = requireProjectRoot();
    const port = parseInt(opts.port, 10);
    startServer(root, port);
  });
