/*
 * The shape of a formatting config is oxfmt's own fact, so this entry does not
 * restate it: `OxfmtConfig` and the two sorter shapes are re-exported from the
 * tool, under the names a consumer already reads here. A hand copy drifts —
 * this one had grown an `endOfLine: 'auto'` oxfmt does not accept, and a
 * consumer's `defineConfig(base)` stopped type-checking because of it.
 */

import type { OxfmtConfig } from 'oxfmt';

declare const base: OxfmtConfig;

export { defineConfig } from 'oxfmt';
export {
    type OxfmtConfig,
    type SortImportsUserConfig as SortImports,
    type SortTailwindcssUserConfig as SortTailwindcss,
} from 'oxfmt';
export { base };
