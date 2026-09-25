import { defineConfig } from 'tsdown';

export default defineConfig({
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
