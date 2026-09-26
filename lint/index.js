import { fileURLToPath } from 'node:url';
import { defineConfig } from 'oxlint';

import hexagonalFragment from './consumer/rulebook/hexagonal.js';
import { PROFILES } from './consumer/rulebook/profiles.js';
import { compile, profile } from './engine/compiler/compile.js';
import { layers as layersFragment } from './engine/compiler/layers.js';

export { merge as compose } from './engine/compiler/compile.js';

// A consumer's bare `from 'oxlint'` resolves only where it declares oxlint itself, which pnpm refuses to assume.
export { defineConfig } from 'oxlint';

const PLUGIN_PATHS = Object.freeze({
    'jterrazz-typescript': fileURLToPath(new URL('consumer/rules/plugin.js', import.meta.url)),
});

export const astro = defineConfig(profile(PROFILES.astro, PLUGIN_PATHS));
export const bun = defineConfig(profile(PROFILES.bun, PLUGIN_PATHS));
export const expo = defineConfig(profile(PROFILES.expo, PLUGIN_PATHS));
export const next = defineConfig(profile(PROFILES.next, PLUGIN_PATHS));
export const node = defineConfig(profile(PROFILES.node, PLUGIN_PATHS));
export const react = defineConfig(profile(PROFILES.react, PLUGIN_PATHS));

export { HEXAGONAL_MAP } from './consumer/rulebook/hexagonal.js';

export const hexagonal = compile(hexagonalFragment);

export function layers(definition) {
    return compile(layersFragment(definition));
}

// oxlint accepts linter `options` in the root config only.
export function nested(config) {
    const { options: _rootOnly, ...subtree } = config;

    return subtree;
}
