/*
 * The tool-facing oxfmt entry (`@jterrazz/typescript/oxfmt`): the shared
 * formatting preset plus oxfmt's own `defineConfig`, for the same reason
 * `oxlint.js` re-exports its tool's — a consumer's config names this package
 * and nothing else:
 *
 *     import { base, defineConfig } from '@jterrazz/typescript/oxfmt';
 *
 *     export default defineConfig(base);
 */

export { defineConfig } from 'oxfmt';

export { default as base } from '../presets/oxfmt/index.js';
