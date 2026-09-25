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
declare const next: OxlintConfig;
declare const node: OxlintConfig;
declare const react: OxlintConfig;

/** The six boundaries the `hexagonal` fragment enforces, as a declared map. */
declare const HEXAGONAL_MAP: readonly Layer[];

/** Merges oxlint configs left to right: lists concatenated and deduped, maps shallow-merged with the last winning. */
declare function compose(...configs: OxlintConfig[]): OxlintConfig;

/** A declared layer map as an additive fragment: one `no-restricted-imports` override per layer. */
declare function layers(definition: { id?: string; map: readonly Layer[] }): OxlintConfig;

/** A profile for a nested oxlint.config: without the `options` oxlint accepts at the root only. */
declare function nested(config: OxlintConfig): OxlintConfig;

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
    nested,
    next,
    node,
    react,
    type RuleEntry,
};
