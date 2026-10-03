import { describe, expect, test } from 'vitest';

import { merge } from './compile.js';

describe('compile', () => {
    test('concatenates and dedupes plugin lists', () => {
        // Given - two configs sharing one jsPlugin
        const merged = merge(
            { jsPlugins: ['a', 'b'], plugins: ['typescript'] },
            { jsPlugins: ['b', 'c'], plugins: ['typescript', 'import'] },
        );

        // Then - order preserved, duplicates dropped
        expect(merged.jsPlugins).toStrictEqual(['a', 'b', 'c']);
        expect(merged.plugins).toStrictEqual(['typescript', 'import']);
    });

    test('shallow-merges rules with the last config winning', () => {
        // Given - two configs disagreeing on one rule
        const merged = merge(
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
        const merged = merge({ overrides: [first] }, { overrides: [second] });

        // Then - both overrides survive, in composition order
        expect(merged.overrides).toStrictEqual([first, second]);
    });

    test('concatenates and dedupes ignorePatterns', () => {
        // Given - overlapping ignore lists
        const merged = merge(
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
        const merged = merge(
            { categories: { correctness: 'off' } },
            { categories: { correctness: 'error' } },
        );

        // Then - last wins, which is the rule for every key the three tables leave out
        expect(merged.categories).toStrictEqual({ correctness: 'error' });
    });

    test('ignores null and undefined configs', () => {
        // Given - a composition with holes (a conditional fragment)
        const merged = merge(
            // @ts-expect-error - a conditional fragment is undefined at runtime, which the merge must survive
            undefined,
            { rules: { curly: 'error' } },
            null,
        );

        // Then - the holes contribute nothing
        expect(merged.rules).toStrictEqual({ curly: 'error' });
    });
});
