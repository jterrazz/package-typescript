import { describe, expect, test } from 'vitest';

import { judge, tightened } from './section.js';

const linterOwns = (rule: string): boolean => !rule.startsWith('names/');

describe('section', () => {
    test('breaks on a count below its entry, and holds one at it', () => {
        // Given - one rule that fell and one that stands at its entry
        const counts = { 'eslint/no-debugger': 1, 'eslint/no-var': 3 };
        const baseline = { 'eslint/no-debugger': 2, 'eslint/no-var': 3 };

        // Then - the fall is the one finding
        expect(judge(counts, baseline)).toStrictEqual([
            'eslint/no-debugger is at 1, below its baseline of 2 — the debt fell, `typescript fix` re-records it',
        ]);
    });

    test('lowers an entry that fell and drops one at zero', () => {
        // Given - one rule that fell, one paid in full, one that stands
        const counts = { 'eslint/no-debugger': 1, 'eslint/no-var': 3 };
        const baseline = { 'eslint/eqeqeq': 4, 'eslint/no-debugger': 2, 'eslint/no-var': 3 };

        // Then - the section records where the project stands
        expect(tightened(counts, baseline, linterOwns)).toStrictEqual({
            'eslint/no-debugger': 1,
            'eslint/no-var': 3,
        });
    });

    test('never raises an entry nor adds a key', () => {
        // Given - one rule that rose, one new, and one that fell
        const counts = { 'eslint/no-debugger': 5, 'eslint/no-unused-vars': 2, 'eslint/no-var': 1 };
        const baseline = { 'eslint/no-debugger': 2, 'eslint/no-var': 3 };

        // Then - only the fall moves; the rise and the new rule stay for the verdict
        expect(tightened(counts, baseline, linterOwns)).toStrictEqual({
            'eslint/no-debugger': 2,
            'eslint/no-var': 1,
        });
    });

    test("keeps every entry it does not own, whatever that entry's count", () => {
        // Given - a Names entry the linter half does not count
        const counts = { 'eslint/no-var': 1 };
        const baseline = { 'eslint/no-var': 3, 'names/no-language-construct-name': 2 };

        // Then - the Names entry is the Names pass's to re-record
        expect(tightened(counts, baseline, linterOwns)).toStrictEqual({
            'eslint/no-var': 1,
            'names/no-language-construct-name': 2,
        });
    });

    test('records nothing when nothing fell', () => {
        // Given - every entry at its count, and one rule above
        const counts = { 'eslint/no-debugger': 3, 'eslint/no-var': 3 };
        const baseline = { 'eslint/no-debugger': 2, 'eslint/no-var': 3 };

        // Then - there is nothing for a fix to write
        expect(tightened(counts, baseline, linterOwns)).toBeUndefined();
    });
});
