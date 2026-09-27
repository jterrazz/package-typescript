import { GROUND_GLOBS } from '../../engine/project/ground.js';
import eslint from './eslint.js';
import astro from './frameworks/astro.js';
import bundler from './frameworks/bundler.js';
import next from './frameworks/next.js';
import reactNative from './frameworks/react-native.js';
import react from './frameworks/react.js';
import importPlugin from './import.js';
import jsdoc from './jsdoc.js';
import jsxA11y from './jsx-a11y.js';
import jterrazzTypescript from './jterrazz-typescript.js';
import node from './node.js';
import oxc from './oxc.js';
import perfectionist from './perfectionist.js';
import promise from './promise.js';
import typescript from './typescript.js';
import unicorn from './unicorn.js';
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
    perfectionist,
    vitest,
]);

// `.artifacts/` is absent on purpose: oxlint reads `.gitignore` itself, and naming it here would make it unlintable by name.
const IGNORED = Object.freeze([
    'dist/**',
    'node_modules/**',
    // The ground a test stands on is deliberately broken or held byte for byte: none of it is source.
    ...GROUND_GLOBS,
]);

export const PROFILES = Object.freeze({
    astro: {
        env: { astro: true, browser: true, builtin: true, node: true },
        fragments: [...CORE, react, jsxA11y, astro],
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
        fragments: [...CORE, react, jsxA11y, reactNative],
        ignorePatterns: [...IGNORED],
    },
    next: {
        env: { browser: true, builtin: true, node: true },
        fragments: [...CORE, react, jsxA11y, next],
        ignorePatterns: [...IGNORED],
    },
    node: {
        env: { builtin: true, node: true },
        fragments: [...CORE],
        ignorePatterns: [...IGNORED],
    },
    react: {
        env: { browser: true, builtin: true, node: true },
        fragments: [...CORE, react, jsxA11y, bundler],
        ignorePatterns: [...IGNORED],
    },
});
