import { defineConfig } from 'oxlint';

import hexagonalFragment from './rulebook/architecture/hexagonal.js';
import { layers as layersFragment } from './rulebook/architecture/layers.js';
import { compile, profile } from './rulebook/compile.js';
import { PROFILES } from './rulebook/profiles.js';

export { merge as compose } from './rulebook/compile.js';

// A consumer's bare `from 'oxlint'` resolves only where it declares oxlint itself, which pnpm refuses to assume.
export { defineConfig } from 'oxlint';

export const astro = defineConfig(profile(PROFILES.astro));
export const bun = defineConfig(profile(PROFILES.bun));
export const expo = defineConfig(profile(PROFILES.expo));
export const next = defineConfig(profile(PROFILES.next));
export const node = defineConfig(profile(PROFILES.node));
export const react = defineConfig(profile(PROFILES.react));

export { HEXAGONAL_MAP } from './rulebook/architecture/hexagonal.js';

export const hexagonal = compile(hexagonalFragment);

export function layers(definition) {
    return compile(layersFragment(definition));
}

// oxlint accepts linter `options` in the root config only.
export function nested(config) {
    const { options: _rootOnly, ...subtree } = config;

    return subtree;
}
