#!/usr/bin/env node
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

// Use tsx to handle TypeScript imports
import("tsx/esm/api").then(({ register: tsxRegister }) => {
  tsxRegister();
  import("../src/cli.js");
}).catch(() => {
  // Fallback: try to import the built version
  import("../dist/cli.js").catch((e) => {
    console.error("Failed to load evomesh. Run `npm run build` or ensure tsx is installed.");
    process.exit(1);
  });
});
