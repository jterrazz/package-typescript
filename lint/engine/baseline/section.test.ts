import { describe, expect, test } from 'vitest';

import { withSection } from './baseline-file.js';
import { judgeExact, judgeFloor, raisedFloor, tightened } from './section.js';
import type { Ratchet } from './section.js';

const linterOwns = (rule: string): boolean => !rule.startsWith('names/');

const RATCHET: Ratchet = { lower: 'typescript fix', record: 'typescript baseline' };

describe('section', () => {
    test('breaks on a count below its entry, and holds one at it', () => {
        // Given - one rule that fell and one that stands at its entry
        const counts = { 'eslint/no-debugger': 1, 'eslint/no-var': 3 };
        const baseline = { 'eslint/no-debugger': 2, 'eslint/no-var': 3 };

        // Then - the fall is the one finding
        expect(judgeExact(counts, baseline, RATCHET)).toStrictEqual([
            {
                rule: 'eslint/no-debugger',
                teaching: {
                    fix: "run 'typescript fix', which re-records the fall",
                    found: '`eslint/no-debugger` is at 1, below its baseline of 2',
                    why: 'each count is held exactly, so a debt that fell is recorded the day it falls and cannot grow back unseen',
                },
            },
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

    test('writes its own section and keeps every other byte of the file', () => {
        // Given - a file another package wrote a section into, in its own indent
        const text =
            '{\n    "test": { "jterrazz-check/a": 2 },\n    "typescript": {\n        "names/b": 1\n    }\n}\n';

        // Then - only the named section changes, in the indent the file already uses
        expect(withSection(text, 'typescript', { 'names/b': 3 })).toBe(
            '{\n    "test": { "jterrazz-check/a": 2 },\n    "typescript": {\n        "names/b": 3\n    }\n}\n',
        );
        expect(withSection(text, 'test.coverage', { 'all/lines': 70 })).toBe(
            '{\n    "test.coverage": {\n        "all/lines": 70\n    },\n    "test": { "jterrazz-check/a": 2 },\n    "typescript": {\n        "names/b": 1\n    }\n}\n',
        );
    });

    test('holds a floor one way: a fall breaks it, a rise is recorded', () => {
        // Given - one measure that fell under its floor and one that rose above it
        const floor = { 'all/branches': 70, 'all/lines': 76.95 };
        const now = { 'all/branches': 69.5, 'all/lines': 80 };

        // Then - the fall is refused, and recording keeps the higher of each
        expect(judgeFloor(now, floor).map(({ rule }) => rule)).toStrictEqual(['all/branches']);
        expect(raisedFloor(now, floor)).toStrictEqual({ 'all/branches': 70, 'all/lines': 80 });
    });
});
