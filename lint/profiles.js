import a11y from './a11y.js';
import astro from './astro.js';
import bundler from './bundler.js';
import eslint from './language/eslint.js';
import importPlugin from './language/import.js';
import jsdoc from './language/jsdoc.js';
import jterrazzTypescript from './language/jterrazz-typescript.js';
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

// A profile adds a framework's plugins and ignores to the core rulebook, and never sets a core rule `off`.

export const CORE = Object.freeze([
    eslint,
    typescript,
    unicorn,
    oxc,
    importPlugin,
    promise,
    node,
    jsdoc,
    jterrazzTypescript,
    sorted,
    vitest,
]);

// `.artifacts/` is absent on purpose: oxlint reads `.gitignore` itself, and naming it here would make it unlintable by name.
const IGNORED = Object.freeze([
    'dist/**',
    'node_modules/**',
    // The ground a test stands on is deliberately broken or held byte for byte: none of it is source.
    '**/fixtures/**',
    '**/expected/**',
    '**/seeds/**',
    '**/requests/**',
]);

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
