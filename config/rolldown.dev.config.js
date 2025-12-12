import { defineConfig } from 'rolldown';

// Dev build - ESM only, no .d.ts (faster rebuilds)
// Externalize all dependencies for Node.js apps
export default defineConfig({
    input: './src/index.ts',
    external: [/node_modules/, /^node:/, /^[a-z@]/],
    output: {
        dir: 'dist',
        format: 'esm',
        sourcemap: true,
    },
});
