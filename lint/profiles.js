import a11y from './a11y.js';
import astro from './astro.js';
import bundler from './bundler.js';
import eslint from './language/eslint.js';
import importPlugin from './language/import.js';
import jsdoc from './language/jsdoc.js';
import node from './language/node.js';
import oxc from './language/oxc.js';
import promise from './language/promise.js';
import typescript from './language/typescript.js';
import unicorn from './language/unicorn.js';
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
 * `src/presets/oxlint/profiles/<name>.js` is this table compiled; nothing else
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
    // The ground a test stands on — its inputs, its goldens, its database
    // state and its requests — is @jterrazz/test's four reserved folders,
    // wherever a test stands (under specs/, and beside a module under src/):
    // an input is deliberately broken and a golden is held byte for byte,
    // so none of it is source and none of it is linted.
    '**/fixtures/**',
    '**/expected/**',
    '**/seeds/**',
    '**/requests/**',
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
    react: {
        env: { browser: true, builtin: true, node: true },
        fragments: [...CORE, react, a11y, bundler],
        ignorePatterns: [...IGNORED],
    },
});
