import type { OxfmtConfig } from 'oxfmt';

declare const base: OxfmtConfig;

export { defineConfig } from 'oxfmt';
export {
    type OxfmtConfig,
    type SortImportsUserConfig as SortImports,
    type SortTailwindcssUserConfig as SortTailwindcss,
} from 'oxfmt';
export { base };
