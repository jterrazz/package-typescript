export const OXLINT_CONFIG = 'oxlint.config.ts';

export const OXFMT_CONFIG = 'oxfmt.config.ts';

export const OXLINT_CONFIG_NAMES: readonly string[] = Object.freeze([
    OXLINT_CONFIG,
    'oxlint.config.mts',
    'oxlint.config.mjs',
    'oxlint.config.js',
    'oxlint.config.cjs',
    '.oxlintrc.json',
    '.oxlintrc.jsonc',
]);

export const OXFMT_CONFIG_NAMES: readonly string[] = Object.freeze([
    '.oxfmtrc.json',
    '.oxfmtrc.jsonc',
    OXFMT_CONFIG,
    'oxfmt.config.mts',
]);

export const namesBeside = (names: readonly string[], derived: string): string[] =>
    names.filter((name) => name !== derived);
