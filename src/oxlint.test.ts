import { expect, test } from 'vitest';

import { compose, defineConfig, hexagonal, layers, nested, react } from './oxlint.js';

test('concatenates and dedupes plugin lists', () => {
    // Given - two configs sharing one jsPlugin
    const merged = compose(
        { jsPlugins: ['a', 'b'], plugins: ['typescript'] },
        { jsPlugins: ['b', 'c'], plugins: ['typescript', 'import'] },
    );

    // Then - order preserved, duplicates dropped
    expect(merged.jsPlugins).toStrictEqual(['a', 'b', 'c']);
    expect(merged.plugins).toStrictEqual(['typescript', 'import']);
});

test('shallow-merges rules with the last config winning', () => {
    // Given - two configs disagreeing on one rule
    const merged = compose(
        { rules: { curly: 'error', 'no-ternary': 'off' } },
        { rules: { curly: 'off', 'jterrazz/b4-given-then': 'error' } },
    );

    // Then - the later config wins per key, others survive
    expect(merged.rules).toStrictEqual({
        curly: 'off',
        'jterrazz/b4-given-then': 'error',
        'no-ternary': 'off',
    });
});

test('concatenates overrides in order without deduping', () => {
    // Given - two configs each shipping an override
    const first = { files: ['**/*.specification.ts'], rules: {} };
    const second = { files: ['src/**'], rules: {} };
    const merged = compose({ overrides: [first] }, { overrides: [second] });

    // Then - both overrides survive, in composition order
    expect(merged.overrides).toStrictEqual([first, second]);
});

test('concatenates and dedupes ignorePatterns', () => {
    // Given - overlapping ignore lists
    const merged = compose(
        { ignorePatterns: ['dist/**', 'node_modules/**'] },
        { ignorePatterns: ['node_modules/**', '**/_fixtures/**'] },
    );

    // Then - one entry each
    expect(merged.ignorePatterns).toStrictEqual(['dist/**', 'node_modules/**', '**/_fixtures/**']);
});

test('takes a key the merge tables do not name from the last config that sets it', () => {
    // Given - configs disagreeing on `categories`, a key the merge tables leave out
    const merged = compose(
        { categories: { correctness: 'off' } },
        { categories: { correctness: 'error' } },
    );

    /*
     * No config this package SHIPS carries a `categories` — every rule is
     * decided by name — and that is exactly why it is the key available here.
     */

    // Then - last wins, which is the rule for every key the three tables leave out
    expect(merged.categories).toStrictEqual({ correctness: 'error' });
});

test('ignores null and undefined configs', () => {
    // Given - a composition with holes (a conditional fragment)
    const merged = compose(
        // @ts-expect-error - a conditional fragment is undefined at runtime, which the merge must survive
        undefined,
        { rules: { curly: 'error' } },
        null,
    );

    // Then - the holes contribute nothing
    expect(merged.rules).toStrictEqual({ curly: 'error' });
});

test('gives a layer map one override per layer, complete', () => {
    // Given - a two-layer map
    const fragment = layers({
        map: [
            {
                deny: ['**/adapters/**'],
                files: ['**/core/**'],
                message: 'the core is pure',
                name: 'core',
            },
        ],
    });

    // Then - the layer's whole pattern list sits inside its own override, because an oxlint override REPLACES the base entry and never merges it
    expect(fragment.overrides).toStrictEqual([
        {
            files: ['**/core/**'],
            rules: {
                'no-restricted-imports': [
                    'error',
                    {
                        patterns: [{ group: ['**/adapters/**'], message: 'the core is pure' }],
                    },
                ],
            },
        },
    ]);
});

/** A map whose two layers claim the same files — the shape `layers()` refuses. */
function buildOverlappingMap() {
    return layers({
        map: [
            { deny: ['**/a/**'], files: ['**/same/**'], message: 'a', name: 'first' },
            { deny: ['**/b/**'], files: ['**/same/**'], message: 'b', name: 'second' },
        ],
    });
}

test('refuses a layer map where one glob belongs to two layers', () => {
    // Given - two layers claiming the same files
    // Then - the map is refused rather than silently losing one of the two
    expect(buildOverlappingMap).toThrow(/belongs to both/u);
});

test('ships the hexagonal map as six complete overrides', () => {
    // Given - the default map
    // Then - one override per layer, and the features carve-out is a negated glob
    expect(hexagonal.overrides).toHaveLength(6);
    expect(JSON.stringify(hexagonal.overrides)).toContain('!**/presentation/features/common/**');
});

test("re-exports oxlint's own defineConfig", () => {
    // Given - a config a consumer would write, with oxlint declared nowhere in its project
    const config = { rules: { curly: 'error' } } as const;

    // Then - the entry carries the tool's helper, which returns the config unchanged
    expect(defineConfig(config)).toBe(config);
});

test('a nested config carries no linter options, which oxlint reads in the root only', () => {
    // Given - a profile, which ships the options every root config needs
    expect(react.options).toBeDefined();

    // Then - its nested form keeps everything but them
    const subtree = nested(compose(react, { rules: { curly: 'off' } }));
    expect(subtree.options).toBeUndefined();
    expect(subtree.plugins).toStrictEqual(react.plugins);
    expect(subtree.rules?.curly).toBe('off');
});
