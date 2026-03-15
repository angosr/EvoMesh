import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  external: ["node-pty"],
  clean: true,
  dts: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
