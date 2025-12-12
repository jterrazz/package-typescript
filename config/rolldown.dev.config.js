import { defineConfig } from 'rolldown';

// Dev build - ESM only, no .d.ts (faster rebuilds)
export default defineConfig({
    input: './src/index.ts',
    output: {
        dir: 'dist',
        format: 'esm',
        sourcemap: true,
    },
});
