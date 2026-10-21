import { describe, expect, test } from 'vitest';

import { parsedObject } from '../../../../../lint/kit/project/json.js';
import { observedFrom, observedOf, observedOnDisk, observedTestsOf, ranBy } from '../observed.js';

describe('observed', () => {
    test('observedFrom — each set of sources written once, a test the run could not follow kept with none, and read back by test', () => {
        // Given - two tests sharing what they loaded, one with nothing, one not followed, one followed halfway
        const observed = observedFrom([
            { loaded: ['a', 'b'], ran: ['a'], test: 'one' },
            { loaded: ['a', 'b'], ran: ['b'], test: 'two' },
            { loaded: [], ran: [], test: 'three' },
            { test: 'four' },
            { ran: ['a'], test: 'five' },
            { loaded: ['a'], test: 'six' },
        ]);
        const read = ranBy(observed);

        // Then - four sets, three tests, each read back whole, the unfollowed ones named with no set and unknown
        expect(observed).toStrictEqual({
            sets: [['a'], ['a', 'b'], ['b'], []],
            tests: {
                five: [-1, -1],
                four: [-1, -1],
                one: [0, 1],
                six: [-1, -1],
                three: [3, 3],
                two: [2, 1],
            },
        });
        expect([read('two'), read('four'), read('five'), read('six')]).toStrictEqual([
            { loaded: new Set(['a', 'b']), ran: new Set(['b']) },
            undefined,
            undefined,
            undefined,
        ]);
    });

    test('observedFrom — a test whose processes ran a file the inputs do not hold, as a build with no map, is one the run could not follow', () => {
        // Given - a test reading a source, one running a built file git does not list, one running both
        const observed = observedFrom(
            [
                { loaded: ['src/a.ts'], ran: ['src/a.ts'], test: 'mapped' },
                { loaded: ['dist/a.js'], ran: ['dist/a.js'], test: 'built' },
                { loaded: ['src/a.ts', 'dist/a.js'], ran: ['src/a.ts'], test: 'both' },
            ],
            { 'src/a.ts': 'hash' },
        );

        // Then - the first alone is followed
        expect(observed.tests).toStrictEqual({ both: [-1, -1], built: [-1, -1], mapped: [0, 0] });
    });

    test('ranBy — a test whose pair names a set the record does not hold is unknown', () => {
        // Given - a record whose test names its loaded set past the end
        const read = ranBy({
            sets: [['a']],
            tests: { brokenLoaded: [0, 5], brokenRan: [5, 0], whole: [0, 0] },
        });

        // Then - unknown, where the whole one reads back
        expect([read('brokenLoaded'), read('brokenRan'), read('whole')]).toStrictEqual([
            undefined,
            undefined,
            { loaded: new Set(['a']), ran: new Set(['a']) },
        ]);
    });

    test('observedOnDisk — every source named once and each set by its indices, read back as it was written', () => {
        // Given - two tests sharing sources
        const observed = observedFrom([
            { loaded: ['b', 'a'], ran: ['b'], test: 'one' },
            { loaded: ['a'], ran: [], test: 'two' },
        ]);

        // When - written to disk and read back
        const onDisk = parsedObject(JSON.stringify(observedOnDisk(observed)));

        // Then - the names sorted once, the sets as indices, and the same record read back
        expect(onDisk).toStrictEqual({
            names: ['a', 'b'],
            sets: [[1], [1, 0], [], [0]],
            tests: { one: [0, 1], two: [2, 3] },
        });
        expect(observedOf(onDisk)).toStrictEqual(observed);
    });

    test('observedTestsOf — the tests a run keeps read back as the dry run observed them, an unfollowed one with no list', () => {
        // Given - a record of a followed test, an unfollowed one, and one the run does not keep
        const observed = observedFrom([
            { loaded: ['a', 'b'], ran: ['a'], test: 'one' },
            { test: 'two' },
            { loaded: ['a'], ran: [], test: 'three' },
        ]);

        // Then - the kept ones, each as it was observed
        expect(observedTestsOf(observed, (key) => key !== 'three')).toStrictEqual([
            { loaded: ['a', 'b'], ran: ['a'], test: 'one' },
            { test: 'two' },
        ]);
    });

    test('observedOf — a record of another shape reads as one that follows no test', () => {
        // Given - nothing, and a record whose parts are not lists
        const records = [
            undefined,
            { names: 'a', sets: 'b', tests: [] },
            { names: 'a', sets: [[0]], tests: {} },
        ];

        // Then - no set, no test, and a set naming no source it can read
        expect(records.map((record) => observedOf(record))).toStrictEqual([
            { sets: [], tests: {} },
            { sets: [], tests: {} },
            { sets: [['']], tests: {} },
        ]);
    });
});
