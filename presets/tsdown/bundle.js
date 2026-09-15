import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    /*
     * `isolatedDeclarations` lives here, not in the `library` tsconfig preset:
     * what it buys is a declaration emitted without a type-checker, which is a
     * property of the PUBLISHED artefact and of nothing else. In the tsconfig
     * it also reached every spec file, where it refused the destructured
     * export a specification hands back ([Developing](../../docs/02-developing.md)).
     * `bundle` is the library command, so the guarantee sits exactly where the
     * tsconfig preset used to put it — and nowhere wider.
     */
    dts: { compilerOptions: { isolatedDeclarations: true } },
    sourcemap: true,
    clean: true,
    hash: false,
    outExtensions: ({ format }) => ({
        js: format === 'cjs' ? '.cjs' : '.js',
    }),
});
