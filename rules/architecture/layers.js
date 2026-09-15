import { fragment, on, scoped } from '../_contract.js';

/*
 * A layer map, compiled to `no-restricted-imports` overrides — one per layer,
 * each carrying that layer's COMPLETE pattern list.
 *
 * Two oxlint semantics shape every line of this file, both verified against
 * 1.83 and both permanent:
 *
 *   - An override's rule OPTIONS REPLACE the base entry; they never merge
 *     (oxc#17527). So a layer's override states every pattern that layer is
 *     bound by, and nothing about layering is left in the base config.
 *   - The `regex` matcher is Rust regex, which has no lookahead. An exception
 *     like "features may not import features, except common" is two `group`
 *     globs — the deny glob, then the same glob negated with `!`.
 *
 * And one limit worth stating: `no-restricted-imports` matches the SPECIFIER
 * STRING, never a resolved path. `../beta/thing.js` does not carry the layer
 * name, so it passes. A layer map is a textual boundary, and a repository that
 * needs a graph boundary declares a dependency-cruiser map beside it.
 */

/**
 * Build a fragment from a layer map. Each layer is
 * `{ name, files, deny, allow?, message }`: `files` are the globs that BELONG
 * to the layer, `deny` the specifier globs it may not import, `allow` the
 * exceptions carved out of them.
 */
export function layers({ id = 'layers', map }) {
    assertDisjoint(id, map);

    return fragment({
        id,
        overrides: map.map((layer) =>
            scoped({
                files: [...layer.files],
                rules: {
                    'no-restricted-imports': on([
                        {
                            patterns: [
                                {
                                    group: [
                                        ...layer.deny,
                                        ...(layer.allow ?? []).map((glob) => `!${glob}`),
                                    ],
                                    message: layer.message,
                                },
                            ],
                        },
                    ]),
                },
            }),
        ),
        rules: {},
    });
}

/*
 * One file belongs to one layer. Two layers sharing a `files` glob would each
 * write an override for it, and the last one would silently erase the first —
 * the replace semantics above. Refuse the map instead of shipping the hole.
 */
function assertDisjoint(id, map) {
    const seen = new Map();
    for (const layer of map) {
        for (const glob of layer.files) {
            if (seen.has(glob)) {
                throw new TypeError(
                    `${id}: "${glob}" belongs to both "${seen.get(glob)}" and "${layer.name}" — an override replaces, so one map entry would erase the other.`,
                );
            }
            seen.set(glob, layer.name);
        }
    }
}
