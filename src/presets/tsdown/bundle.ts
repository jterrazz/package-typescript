import { defineConfig } from 'tsdown';
import type { UserConfig } from 'tsdown';

export type { UserConfig } from 'tsdown';

/** A library bundle: ESM and CJS outputs with declarations and source maps. */
const bundle: UserConfig = defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    // Only the published build: under the tsconfig it would also bind every spec's destructured export.
    dts: { compilerOptions: { isolatedDeclarations: true } },
    sourcemap: true,
    clean: true,
    hash: false,
    outExtensions: ({ format }) => ({
        js: format === 'cjs' ? '.cjs' : '.js',
    }),
});

export default bundle;
