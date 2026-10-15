import { describe, expect, test } from 'vitest';

import { observedFrom, ranBy } from '../observed.js';

describe('observed', () => {
    test('observedFrom — each set of sources written once, a test the run could not follow left out, and read back by test', () => {
        // Given - two tests sharing what they loaded, one with nothing, one not followed
        const observed = observedFrom([
            { loaded: ['a', 'b'], ran: ['a'], test: 'one' },
            { loaded: ['a', 'b'], ran: ['b'], test: 'two' },
            { loaded: [], ran: [], test: 'three' },
            { test: 'four' },
        ]);
        const read = ranBy(observed);

        // Then - four sets, three tests, each read back whole, the unfollowed one unknown
        expect(observed).toStrictEqual({
            sets: [['a'], ['a', 'b'], ['b'], []],
            tests: { one: [0, 1], three: [3, 3], two: [2, 1] },
        });
        expect([read('two'), read('four'), ranBy(undefined)('one')]).toStrictEqual([
            { loaded: new Set(['a', 'b']), ran: new Set(['b']) },
            undefined,
            undefined,
        ]);
    });

    test('observedFrom — a test whose processes ran a file the inputs do not hold, as a build with no map, is one the run could not follow', () => {
        // Given - a test reading a source, one running a built file git does not list
        const observed = observedFrom(
            [
                { loaded: ['src/a.ts'], ran: ['src/a.ts'], test: 'mapped' },
                { loaded: ['dist/a.js'], ran: ['dist/a.js'], test: 'built' },
            ],
            { 'src/a.ts': 'hash' },
        );

        // Then - the first alone is followed
        expect(Object.keys(observed.tests)).toStrictEqual(['mapped']);
    });
});
