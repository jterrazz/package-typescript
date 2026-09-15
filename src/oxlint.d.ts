/*
 * The shape of a lint config is oxlint's own fact, so this entry does not
 * restate it: `OxlintConfig` and `OxlintOverride` are re-exported from the
 * tool, under the names a consumer already reads here. A hand copy drifts —
 * this one had `plugins?: string[]` where oxlint takes a closed union, and a
 * consumer's `defineConfig(node)` stopped type-checking.
 */

import type { OxlintConfig } from 'oxlint';

/** A rule entry as oxlint reads it: a level, or a level and its options. */
type RuleEntry = NonNullable<OxlintConfig['rules']>[string];

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
declare const react: OxlintConfig;

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
export { type OxlintConfig, type OxlintOverride } from 'oxlint';
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
    react,
    type RuleEntry,
};
