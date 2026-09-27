import { refusal } from '../catalogue/lesson.js';
import { fragment, on, scoped } from './decision.js';
import type { Fragment } from './decision.js';

// oxlint, verified on 1.83: an override's options replace the base entry (oxc#17527); `regex` is Rust regex
// with no lookahead, so an exception is a second glob negated with `!`; and the rule matches the specifier
// string, never a resolved path — a graph boundary is dependency-cruiser's.

/** One layer of a map: the files that belong to it, and what they may not import. */
export type Layer = {
    /** Exceptions carved out of `deny`. */
    allow?: readonly string[];
    /** Whether a type-only import may cross. */
    allowTypeImports?: boolean;
    /** The specifier globs it may not import. */
    deny: readonly string[];
    /** The globs that belong to the layer. */
    files: readonly string[];
    /** What a refusal says. */
    message: string;
    /** What the layer is called in a refusal. */
    name: string;
};

export function layers({ id = 'layers', map }: { id?: string; map: readonly Layer[] }): Fragment {
    if (typeof id !== 'string' || id === '') {
        throw new TypeError(
            refusal({
                fix: "name the map — `layers({ id: '<name>', map })`",
                found: 'A layer map needs an id.',
                read: 'docs/07-lint-presets.md#a-map-the-compiler-refuses',
                why: 'the fragment the map compiles to answers to that id',
            }),
        );
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
function assertDisjoint(id: string, map: readonly Layer[]): void {
    const seen = new Map<string, string>();
    for (const layer of map) {
        for (const glob of layer.files) {
            if (seen.has(glob)) {
                throw new TypeError(
                    refusal({
                        fix: 'give each glob to one layer — split the glob, or merge the two layers',
                        found: `${id}: "${glob}" belongs to both "${seen.get(glob) ?? ''}" and "${layer.name}"`,
                        read: 'docs/07-lint-presets.md#a-map-the-compiler-refuses',
                        why: 'an override replaces, so one map entry would erase the other',
                    }),
                );
            }
            seen.set(glob, layer.name);
        }
    }
}
