import { fileURLToPath } from 'node:url';
import { defineConfig } from 'oxlint';
import type { OxlintConfig } from 'oxlint';

import hexagonalFragment from './consumer/rulebook/hexagonal.js';
import { PROFILES } from './consumer/rulebook/profiles.js';
import { compile, profile } from './engine/compiler/compile.js';
import { layers as layersFragment } from './engine/compiler/layers.js';
import type { Layer } from './engine/compiler/layers.js';

/** Merges oxlint configs left to right: lists concatenated and deduped, maps shallow-merged with the last winning. */
export { merge as compose } from './engine/compiler/compile.js';

// A consumer's bare `from 'oxlint'` resolves only where it declares oxlint itself, which pnpm refuses to assume.
export { defineConfig } from 'oxlint';
export type { OxlintConfig, OxlintOverride } from 'oxlint';
export type { Layer } from './engine/compiler/layers.js';

/** A rule entry as oxlint reads it: a level, or a level and its options. */
export type RuleEntry = NonNullable<OxlintConfig['rules']>[string];

const PLUGIN_PATHS: Readonly<Record<string, string>> = Object.freeze({
    'jterrazz-typescript': fileURLToPath(new URL('plugin.js', import.meta.url)),
});

export const astro: OxlintConfig = defineConfig(profile(PROFILES.astro, PLUGIN_PATHS));
export const bun: OxlintConfig = defineConfig(profile(PROFILES.bun, PLUGIN_PATHS));
export const expo: OxlintConfig = defineConfig(profile(PROFILES.expo, PLUGIN_PATHS));
export const next: OxlintConfig = defineConfig(profile(PROFILES.next, PLUGIN_PATHS));
export const node: OxlintConfig = defineConfig(profile(PROFILES.node, PLUGIN_PATHS));
export const react: OxlintConfig = defineConfig(profile(PROFILES.react, PLUGIN_PATHS));

/** The six boundaries the `hexagonal` fragment enforces, as a declared map. */
export { HEXAGONAL_MAP } from './consumer/rulebook/hexagonal.js';

export const hexagonal: OxlintConfig = compile(hexagonalFragment);

/** A declared layer map as an additive fragment: one `no-restricted-imports` override per layer. */
export function layers(definition: { id?: string; map: readonly Layer[] }): OxlintConfig {
    return compile(layersFragment(definition));
}

/** A profile for a nested oxlint.config: without the `options` oxlint accepts at the root only. */
export function nested(config: OxlintConfig): OxlintConfig {
    const { options: _rootOnly, ...subtree } = config;

    return subtree;
}
