import { defineConfig } from 'oxfmt';

export default defineConfig({
    printWidth: 100,
    tabWidth: 4,
    useTabs: false,
    semi: true,
    singleQuote: true,
    trailingComma: 'all',
    bracketSpacing: true,
    endOfLine: 'lf',
    /* `typescript docs` writes the byte-for-byte typedoc tree to docs/reference/ —
     * formatting it would fight the Docs (sync) pass, so skip it by default. */
    ignorePatterns: ['docs/reference'],
});
