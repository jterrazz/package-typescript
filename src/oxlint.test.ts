import { expect, test } from 'vitest';

import { compose, expo, hexagonal, next, node } from './oxlint.js';

test('concatenates and dedupes plugin lists', () => {
    // Given - two fragments sharing one jsPlugin
    const merged = compose(
        { jsPlugins: ['a', 'b'], plugins: ['typescript'] },
        { jsPlugins: ['b', 'c'], plugins: ['typescript', 'import'] },
    );

    // Then - order preserved, duplicates dropped
    expect(merged.jsPlugins).toEqual(['a', 'b', 'c']);
    expect(merged.plugins).toEqual(['typescript', 'import']);
});

test('shallow-merges rules with last fragment winning', () => {
    // Given - two fragments disagreeing on one rule
    const merged = compose(
        { rules: { curly: 'error', 'no-ternary': 'off' } },
        { rules: { curly: 'off', 'jterrazz/b4-given-then': 'error' } },
    );

    // Then - the later fragment wins per key, others survive
    expect(merged.rules).toEqual({
        curly: 'off',
        'jterrazz/b4-given-then': 'error',
        'no-ternary': 'off',
    });
});

test('concatenates overrides in order without deduping', () => {
    // Given - two fragments each shipping an override
    const first = { files: ['**/*.specification.ts'], rules: {} };
    const second = { files: ['src/**'], rules: {} };
    const merged = compose({ overrides: [first] }, { overrides: [second] });

    // Then - both overrides survive, in composition order
    expect(merged.overrides).toEqual([first, second]);
});

test('concatenates and dedupes ignorePatterns', () => {
    // Given - overlapping ignore lists
    const merged = compose(
        { ignorePatterns: ['dist/**', 'node_modules/**'] },
        { ignorePatterns: ['node_modules/**', '**/fixtures/**'] },
    );

    // Then - one entry each
    expect(merged.ignorePatterns).toEqual(['dist/**', 'node_modules/**', '**/fixtures/**']);
});

test('takes unknown scalar keys from the last fragment', () => {
    // Given - fragments disagreeing on a scalar key
    const merged = compose({ somethingElse: 1 }, { somethingElse: 2 });

    // Then - last wins
    expect(merged.somethingElse).toBe(2);
});

test('ignores null and undefined fragments', () => {
    // Given - a composition with holes (conditional fragments)
    const merged = compose(
        undefined as unknown as Record<string, unknown>,
        { rules: { curly: 'error' } },
        null as unknown as Record<string, unknown>,
    );

    // Then - the holes contribute nothing
    expect(merged.rules).toEqual({ curly: 'error' });
});

test('exports the named presets', () => {
    // Given - the tool-facing entry
    // Then - every preset is a config object
    for (const preset of [node, expo, next, hexagonal]) {
        expect(typeof preset).toBe('object');
    }
});
