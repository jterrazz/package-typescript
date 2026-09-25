import { fragment, on, scoped } from '../_contract.js';

// oxlint, verified on 1.83: an override's options replace the base entry (oxc#17527); `regex` is Rust regex
// with no lookahead, so an exception is a second glob negated with `!`; and the rule matches the specifier
// string, never a resolved path — a graph boundary is dependency-cruiser's.

/**
 * @typedef {object} Layer One row of a layer map.
 * @property {string} name What the layer is called in a refusal.
 * @property {readonly string[]} files The globs that belong to the layer.
 * @property {readonly string[]} deny The specifier globs it may not import.
 * @property {readonly string[]} [allow] Exceptions carved out of `deny`.
 * @property {boolean} [allowTypeImports] Whether a type-only import may cross.
 * @property {string} message What a refusal says.
 */

/**
 * @param {{ id?: string, map: readonly Layer[] }} definition the map, and the id the fragment answers to
 * @returns {Omit<ReturnType<typeof fragment>, 'overrides'> & { overrides: readonly import('../_contract.js').Scoped[] }} one override per layer
 */
export function layers({ id = 'layers', map }) {
    if (typeof id !== 'string' || id === '') {
        throw new TypeError('A layer map needs an id.');
    }
    assertDisjoint(id, map);

    return fragment({
        id,
        audience: 'consumer',
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
                                    ...(layer.allowTypeImports === true
                                        ? { allowTypeImports: true }
                                        : {}),
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

// Two layers sharing a glob would each write an override, and the last would silently erase the first.
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
