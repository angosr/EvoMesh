#!/usr/bin/env node

// Prefer compiled dist/ for faster startup (no tsx overhead).
// Fall back to tsx + src/ for development.
import("../dist/cli.js").catch(() => {
  import("tsx/esm/api").then(({ register }) => {
    register();
    import("../src/cli.js");
  }).catch(() => {
    console.error("Failed to load evomesh. Run `npm run build` or ensure tsx is installed.");
    process.exit(1);
  });
});
