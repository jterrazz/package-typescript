import { existsSync } from "node:fs";
import { defineConfig } from "rolldown";

// Build input with optional instrumentation entry point
const input = {
  index: "src/index.ts",
  ...(existsSync("src/instrumentation.ts") && { instrumentation: "src/instrumentation.ts" }),
};

// Dev build - ESM only, no .d.ts (faster rebuilds)
// Externalize all dependencies for Node.js apps
export default defineConfig({
  input,
  external: [/node_modules/, /^node:/, /^[a-z@]/],
  output: {
    dir: "dist",
    format: "esm",
    sourcemap: true,
  },
});
