import a11y from './a11y.js';
import astro from './astro.js';
import eslint from './core/eslint.js';
import importPlugin from './core/import.js';
import jsdoc from './core/jsdoc.js';
import node from './core/node.js';
import oxc from './core/oxc.js';
import promise from './core/promise.js';
import typescript from './core/typescript.js';
import unicorn from './core/unicorn.js';
import next from './next.js';
import reactNative from './react-native.js';
import react from './react.js';
import sorted from './sorted.js';
import vitest from './vitest.js';

/*
 * Which fragments each profile carries. A profile ADDS a framework's plugins
 * and its ignore patterns to the core rulebook; it never subtracts from it, and
 * no profile sets a core rule to `off`
 * ([Lint presets](../docs/07-lint-presets.md)).
 *
 * `presets/oxlint/profiles/<name>.js` is this table compiled; nothing else
 * decides what a profile holds.
 */

/** The rulebook every profile carries, whatever it is written in. */
export const CORE = Object.freeze([
    eslint,
    typescript,
    unicorn,
    oxc,
    importPlugin,
    promise,
    node,
    jsdoc,
    sorted,
    vitest,
]);

/*
 * Trees no profile lints. `.artifacts/` is deliberately absent: it is
 * gitignored and oxlint reads `.gitignore` on its own, so naming it here too
 * would make it unlintable even where a caller asks for it by name.
 */
const IGNORED = Object.freeze([
    'dist/**',
    'node_modules/**',
    // What a spec stands on and what it is measured against are @jterrazz/test
    // 14's underscored trees: an input is deliberately broken and a golden is
    // Byte-for-byte, so neither is source and neither is linted.
    '**/_fixtures/**',
    '**/_expected/**',
]);

/** Every profile, by the name a consumer imports. */
export const PROFILES = Object.freeze({
    astro: {
        env: { astro: true, browser: true, builtin: true, node: true },
        fragments: [...CORE, react, a11y, astro],
        ignorePatterns: [...IGNORED],
    },
    bun: {
        env: { builtin: true, node: true },
        fragments: [...CORE],
        globals: { Bun: 'readonly' },
        ignorePatterns: [...IGNORED],
    },
    expo: {
        env: { browser: true, builtin: true, node: true },
        fragments: [...CORE, react, a11y, reactNative],
        ignorePatterns: [...IGNORED],
    },
    library: {
        env: { builtin: true, node: true },
        fragments: [...CORE],
        ignorePatterns: [...IGNORED, 'docs/reference/**'],
    },
    next: {
        env: { browser: true, builtin: true, node: true },
        fragments: [...CORE, react, a11y, next],
        ignorePatterns: [...IGNORED],
    },
    node: {
        env: { builtin: true, node: true },
        fragments: [...CORE],
        ignorePatterns: [...IGNORED],
    },
});
