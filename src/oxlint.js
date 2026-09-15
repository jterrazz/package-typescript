/*
 * The tool-facing oxlint entry (`@jterrazz/typescript/oxlint`): the seven
 * profiles, the `compose()` merger, the layer-map builder, and oxlint's own
 * `defineConfig`. A consumer names a PROFILE, not a set of fragments:
 *
 *     import { defineConfig, node } from '@jterrazz/typescript/oxlint';
 *
 *     export default defineConfig({ extends: [node] });
 *
 * What each profile carries, and why every rule of every loaded plugin is
 * decided by name, is [Lint presets](../docs/07-lint-presets.md).
 *
 * `rules/` holds the manifest — decisions, with a reason behind every `off`.
 * What crosses this file is always a plain oxlint config, compiled from it.
 */

import hexagonalFragment from '../rules/architecture/hexagonal.js';
import { layers as layersFragment } from '../rules/architecture/layers.js';
import { compile } from '../rules/compile.js';

export { merge as compose } from '../rules/compile.js';

/* Oxlint's own `defineConfig`, re-exported from here: a bare
 * `import { defineConfig } from 'oxlint'` in a consumer's config resolves only
 * where the consumer declares oxlint itself, which pnpm's strict node_modules
 * refuses to assume. Resolved from THIS package — where oxlint is a real
 * dependency — the one-devDependency shape holds on every package manager. */
export { defineConfig } from 'oxlint';

export { default as astro } from '../presets/oxlint/profiles/astro.js';
export { default as bun } from '../presets/oxlint/profiles/bun.js';
export { default as expo } from '../presets/oxlint/profiles/expo.js';
export { default as library } from '../presets/oxlint/profiles/library.js';
export { default as next } from '../presets/oxlint/profiles/next.js';
export { default as node } from '../presets/oxlint/profiles/node.js';
export { default as react } from '../presets/oxlint/profiles/react.js';

export { HEXAGONAL_MAP } from '../rules/architecture/hexagonal.js';

/** The hexagonal layer map, ready to compose beside a profile. */
export const hexagonal = compile(hexagonalFragment);

/**
 * A declared layer map as an additive oxlint fragment: one
 * `no-restricted-imports` override per layer, each carrying that layer's
 * complete pattern list (an oxlint override REPLACES, it never merges).
 */
export function layers(definition) {
    return compile(layersFragment(definition));
}
