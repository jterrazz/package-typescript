/*
 * The tool-facing oxlint entry (`@jterrazz/typescript/oxlint`): the named
 * presets plus the `compose()` helper. Wiring is EXPLICIT — a consumer
 * composes exactly the fragments it wants, nothing is auto-detected:
 *
 *     import { testing } from '@jterrazz/test/oxlint';
 *     import { compose, node } from '@jterrazz/typescript/oxlint';
 *
 *     export default compose(node, testing);
 */

/** Config keys concatenated across fragments, duplicates dropped (===). */
const CONCAT_DEDUPE = new Set(['extends', 'ignorePatterns', 'jsPlugins', 'plugins']);
/** Config keys concatenated verbatim (order matters, no dedupe). */
const CONCAT = new Set(['overrides']);
/** Config keys shallow-merged as objects — the LAST fragment wins per key. */
const SHALLOW_MERGE = new Set(['categories', 'env', 'globals', 'rules', 'settings']);

/**
 * Deterministic merge of oxlint config fragments, left to right:
 * `jsPlugins` / `plugins` / `ignorePatterns` / `extends` are concatenated and
 * deduped, `rules` / `categories` (and env/globals/settings) are shallow-merged
 * with last-wins per key, `overrides` are concatenated, and any other key is
 * taken from the last fragment that sets it.
 */
export function compose(...fragments) {
    const merged = {};
    for (const fragment of fragments) {
        if (!fragment || typeof fragment !== 'object') {
            continue;
        }
        for (const [key, value] of Object.entries(fragment)) {
            if (value === undefined) {
                continue;
            }
            if (CONCAT_DEDUPE.has(key)) {
                const previous = Array.isArray(merged[key]) ? merged[key] : [];
                const combined = [...previous, ...(Array.isArray(value) ? value : [value])];
                merged[key] = combined.filter((entry, index) => combined.indexOf(entry) === index);
            } else if (CONCAT.has(key)) {
                const previous = Array.isArray(merged[key]) ? merged[key] : [];
                merged[key] = [...previous, ...(Array.isArray(value) ? value : [value])];
            } else if (SHALLOW_MERGE.has(key)) {
                merged[key] = { ...merged[key], ...value };
            } else {
                merged[key] = value;
            }
        }
    }
    return merged;
}

export { default as hexagonal } from '../presets/oxlint/architectures/hexagonal.js';
export { default as expo } from '../presets/oxlint/expo.js';
export { default as next } from '../presets/oxlint/next.js';
export { default as node } from '../presets/oxlint/node.js';
