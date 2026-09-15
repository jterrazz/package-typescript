/** A rule entry as oxlint reads it: a level, or a level and its options. */
type RuleEntry = 'error' | 'off' | ['error', ...unknown[]];

/** A scoped block. Its rule options REPLACE the base entry — they never merge. */
type OxlintOverride = {
    files: string[];
    rules: Record<string, RuleEntry>;
};

/** A plain oxlint configuration object: what every export of this entry is. */
type OxlintConfig = {
    /** oxlint's own schema key, and whatever key a later oxlint adds. */
    [key: string]: unknown;
    env?: Record<string, boolean>;
    extends?: OxlintConfig[];
    globals?: Record<string, 'off' | 'readonly' | 'writable'>;
    ignorePatterns?: string[];
    jsPlugins?: string[];
    options?: {
        reportUnusedDisableDirectives?: 'error' | 'off' | 'warn';
        typeAware?: boolean;
        typeCheck?: boolean;
    };
    overrides?: OxlintOverride[];
    plugins?: string[];
    rules?: Record<string, RuleEntry>;
    settings?: Record<string, unknown>;
};

/** One layer of a map: the files that belong to it, and what they may not import. */
type Layer = {
    allow?: string[];
    deny: string[];
    files: string[];
    message: string;
    name: string;
};

declare const astro: OxlintConfig;
declare const bun: OxlintConfig;
declare const expo: OxlintConfig;
declare const hexagonal: OxlintConfig;
declare const library: OxlintConfig;
declare const next: OxlintConfig;
declare const node: OxlintConfig;

/** The six boundaries the `hexagonal` fragment enforces, as a declared map. */
declare const HEXAGONAL_MAP: readonly Layer[];

/**
 * Deterministic merge of oxlint config objects, left to right:
 * jsPlugins/plugins/ignorePatterns/extends concatenated and deduped,
 * rules/env/globals/options/settings shallow-merged (last wins),
 * overrides concatenated.
 */
declare function compose(...configs: OxlintConfig[]): OxlintConfig;

/**
 * A declared layer map as an additive fragment: one `no-restricted-imports`
 * override per layer, each carrying that layer's complete pattern list.
 */
declare function layers(definition: { id?: string; map: readonly Layer[] }): OxlintConfig;

export { defineConfig } from 'oxlint';
export {
    astro,
    bun,
    compose,
    expo,
    hexagonal,
    HEXAGONAL_MAP,
    type Layer,
    layers,
    library,
    next,
    node,
    type OxlintConfig,
    type OxlintOverride,
    type RuleEntry,
};
