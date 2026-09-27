import { describe, expect, test } from 'vitest';

import { astro, bun, compose, defineConfig, expo, nested, next, node, react } from './index.js';

describe('index', () => {
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
            { rules: { curly: 'off', 'jterrazz/given-and-then-markers-present': 'error' } },
        );

        // Then - the later config wins per key, others survive
        expect(merged.rules).toStrictEqual({
            curly: 'off',
            'jterrazz/given-and-then-markers-present': 'error',
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
        expect(merged.ignorePatterns).toStrictEqual([
            'dist/**',
            'node_modules/**',
            '**/_fixtures/**',
        ]);
    });

    test('takes a key the merge tables do not name from the last config that sets it', () => {
        // Given - configs disagreeing on `categories`, a key the merge tables leave out
        const merged = compose(
            { categories: { correctness: 'off' } },
            { categories: { correctness: 'error' } },
        );

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

    test.each(Object.entries({ astro, bun, expo, next, node, react }))(
        'the %s profile never lints the ground a spec stands on',
        (_name, profile) => {
            // Given - a profile a consumer names
            // Then - the four ground folders among the `_` names @jterrazz/test reserves are ignored wherever they sit
            expect(profile.ignorePatterns).toStrictEqual(
                expect.arrayContaining([
                    '**/_fixtures/**',
                    '**/_expected/**',
                    '**/_seeds/**',
                    '**/_requests/**',
                ]),
            );
        },
    );
});
