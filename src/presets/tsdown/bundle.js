import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    // Here and not in the `library` tsconfig: there it reached every spec and refused a specification's destructured export.
    dts: { compilerOptions: { isolatedDeclarations: true } },
    sourcemap: true,
    clean: true,
    hash: false,
    outExtensions: ({ format }) => ({
        js: format === 'cjs' ? '.cjs' : '.js',
    }),
});
