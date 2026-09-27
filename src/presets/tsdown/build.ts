import { defineConfig } from 'tsdown';
import type { UserConfig } from 'tsdown';

export type { UserConfig } from 'tsdown';

/** An application build: one ESM output with declarations and source maps. */
const build: UserConfig = defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    hash: false,
    outExtensions: () => ({
        js: '.js',
    }),
});

export default build;
