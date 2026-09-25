import hexagonalFragment from '../lint/architecture/hexagonal.js';
import { layers as layersFragment } from '../lint/architecture/layers.js';
import { compile } from '../lint/compile.js';

export { merge as compose } from '../lint/compile.js';

// A consumer's bare `from 'oxlint'` resolves only where it declares oxlint itself, which pnpm refuses to assume.
export { defineConfig } from 'oxlint';

export { default as astro } from './presets/oxlint/profiles/astro.js';
export { default as bun } from './presets/oxlint/profiles/bun.js';
export { default as expo } from './presets/oxlint/profiles/expo.js';
export { default as next } from './presets/oxlint/profiles/next.js';
export { default as node } from './presets/oxlint/profiles/node.js';
export { default as react } from './presets/oxlint/profiles/react.js';

export { HEXAGONAL_MAP } from '../lint/architecture/hexagonal.js';

export const hexagonal = compile(hexagonalFragment);

export function layers(definition) {
    return compile(layersFragment(definition));
}

// oxlint accepts linter `options` in the root config only.
export function nested(config) {
    const { options: _rootOnly, ...subtree } = config;

    return subtree;
}
