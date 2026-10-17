import { describe, expect, test } from 'vitest';

import { isList, objectOf } from '../../../../lint/kit/project/json.js';
import { ownBuildOf, reachOf } from '../inputs.js';
import { observedFrom, ranBy } from '../observed.js';
import type { ObservedTest } from '../observed.js';
import { reportAfter } from '../staleness.js';
import type { Staleness } from '../staleness.js';

const mutant = (id: string, coveredBy: string[], killedBy: string[] = []) => ({
    coveredBy,
    id,
    killedBy,
    location: { end: { column: 2, line: 1 }, start: { column: 1, line: 1 } },
    mutatorName: 'BooleanLiteral',
    status: killedBy.length > 0 ? 'Killed' : 'Survived',
});

const A_MUTANTS = [mutant('1', ['0', '1']), mutant('2', ['1'], ['1'])];

const REPORT = {
    files: {
        'src/a.ts': { mutants: A_MUTANTS, source: 'a' },
        'src/b.ts': { mutants: [mutant('3', ['2'], ['2'])], source: 'b' },
    },
    schemaVersion: '2',
    testFiles: {
        'specs/a.spec.ts': { tests: [{ id: '1', name: 'a spec' }] },
        'src/__tests__/a.test.ts': { tests: [{ id: '0', name: 'a test' }] },
        'src/__tests__/b.test.ts': { tests: [{ id: '2', name: 'b test' }] },
    },
};

const SOURCES = new Map([
    ['src/a.ts', ''],
    ['src/b.ts', "import { h } from './h.js';"],
    ['src/h.ts', ''],
    ['src/__tests__/a.test.ts', "import { a } from '../a.js';"],
    ['src/__tests__/b.test.ts', "import { b } from '../b.js';"],
]);

const quiet = (key: string): ObservedTest => ({ loaded: [], ran: [], test: key });

const MODULE_TESTS = [
    quiet('src/__tests__/a.test.ts#a test'),
    quiet('src/__tests__/b.test.ts#b test'),
];

const SPEC_QUIET = [...MODULE_TESTS, quiet('specs/a.spec.ts#a spec')];

const SPEC_RAN_A = [
    ...MODULE_TESTS,
    {
        loaded: ['src/a.ts', 'src/b.ts', 'src/h.ts'],
        ran: ['src/a.ts'],
        test: 'specs/a.spec.ts#a spec',
    },
];

const staleness = (
    observed: readonly ObservedTest[],
    onlyFunctions: readonly string[] = [],
): Staleness => ({
    onlyFunctions: (source) => onlyFunctions.includes(source),
    ranBy: ranBy(observedFrom(observed)),
    reach: reachOf(SOURCES, ownBuildOf({ name: '@scope/package' })),
});

const idOf = (one: unknown): string => String(objectOf(one).id);

function idsByFile(report: unknown): Record<string, string[]> {
    const files = Object.entries(objectOf(objectOf(report).files));

    return Object.fromEntries(
        files.map(([file, entry]) => {
            const { mutants } = objectOf(entry);

            return [file, isList(mutants) ? mutants.map(idOf) : []];
        }),
    );
}

function keptIds(
    changed: string[],
    observed: readonly ObservedTest[] = MODULE_TESTS,
    onlyFunctions: readonly string[] = [],
): Record<string, string[]> | undefined {
    const report = reportAfter(REPORT, changed, staleness(observed, onlyFunctions));

    return report === undefined ? undefined : idsByFile(report);
}

describe('reportAfter', () => {
    test('staleness — reportAfter — a change in a covering test re-measures the survivor it covered and the kill it made, and no other', () => {
        // Given - the report of a run
        // When - the spec changes
        const kept = keptIds(['specs/a.spec.ts']);

        // Then - the survivor it covers and the mutant it killed go, b's stays
        expect(kept).toStrictEqual({ 'src/a.ts': [], 'src/b.ts': ['3'] });
    });

    test('staleness — reportAfter — a helper a test loads in its own process re-measures that test’s mutants, though neither the mutated source nor the test changed', () => {
        // Given - the report of a run, its module tests seen spawning nothing and its spec not followed into its processes
        // When - h.ts, which b.ts imports, changes
        const kept = keptIds(['src/h.ts']);

        // Then - b's mutant goes with its test; a's module test does not reach h, but the spec, whose processes the run could not follow, may have run any source
        expect(kept).toStrictEqual({ 'src/a.ts': [], 'src/b.ts': [] });
    });

    test('staleness — reportAfter — a source change leaves the mutants whose every covering test spawned nothing and does not load it', () => {
        // Given - the report of a run, its spec seen spawning nothing too
        // When - h.ts changes
        const kept = keptIds(['src/h.ts'], SPEC_QUIET);

        // Then - only b's mutant, whose test reaches h, is measured again
        expect(kept).toStrictEqual({ 'src/a.ts': ['1', '2'], 'src/b.ts': [] });
    });

    test('staleness — reportAfter: every mutant of a changed source is measured again, whoever covers it', () => {
        // Given - the report of a run, no test seen spawning
        // When - b.ts itself changes
        const kept = keptIds(['src/b.ts'], SPEC_QUIET);

        // Then - its file leaves the report whole
        expect(kept).toStrictEqual({ 'src/a.ts': ['1', '2'] });
    });

    test('staleness — reportAfter — a source a spawned process ran re-measures the spec’s mutants, whatever the change', () => {
        // Given - the report of a run, its spec's processes seen running a.ts and loading the rest of the build
        // When - a.ts changes inside a function
        const kept = keptIds(['src/a.ts'], SPEC_RAN_A, ['src/a.ts']);

        // Then - a.ts leaves whole, and b's mutant, which no test reaching a covers, stays
        expect(kept).toStrictEqual({ 'src/b.ts': ['3'] });
    });

    test('staleness — reportAfter — a source a spawned process only loaded keeps the spec’s mutants while the change stays inside its functions', () => {
        // Given - the report of a run, its spec's processes seen running a.ts and loading h.ts, which its module test does not reach
        // When - h.ts changes inside a function, then as it loads
        const inFunctions = keptIds(['src/h.ts'], SPEC_RAN_A, ['src/h.ts']);
        const asItLoads = keptIds(['src/h.ts'], SPEC_RAN_A, []);

        // Then - inside its functions, only b's mutant, whose test imports h, is measured again; as it loads, the spec's go too
        expect([inFunctions, asItLoads]).toStrictEqual([
            { 'src/a.ts': ['1', '2'], 'src/b.ts': [] },
            { 'src/a.ts': [], 'src/b.ts': [] },
        ]);
    });

    test('staleness — reportAfter — a source no spawned process loaded keeps the spec’s mutants, whatever the change', () => {
        // Given - the report of a run, its spec's processes seen loading only a.ts
        const observed = [
            ...MODULE_TESTS,
            { loaded: ['src/a.ts'], ran: ['src/a.ts'], test: 'specs/a.spec.ts#a spec' },
        ];

        // When - h.ts changes as it loads
        const kept = keptIds(['src/h.ts'], observed);

        // Then - only the module test importing it is stale
        expect(kept).toStrictEqual({ 'src/a.ts': ['1', '2'], 'src/b.ts': [] });
    });

    test.each([
        [
            'under the folder of the module tests',
            'src/__tests__/__fixtures__/f.json',
            { 'src/a.ts': ['2'], 'src/b.ts': [] },
        ],
        ['under the specs', 'specs/__expected__/out.txt', { 'src/a.ts': [], 'src/b.ts': ['3'] }],
        ['at the root', '__fixtures__/f.json', { 'src/a.ts': [], 'src/b.ts': [] }],
    ])(
        'staleness — reportAfter — ground %s re-measures what the tests below it covered',
        (_where, ground, kept) => {
            // Given - the report of a run, every test seen quiet
            // Then - a test under the ground's folder is stale, one beside it is not
            expect(keptIds([ground], SPEC_QUIET)).toStrictEqual(kept);
        },
    );

    test.each([
        ['a setup file', 'specs/__setup__/seed.ts'],
        ['a root config', 'vitest.config.ts'],
        ['the install', 'node_modules/.package-lock.json'],
        ['a data file code reads', 'src/catalogue.json'],
    ])(
        'staleness — reportAfter — %s reaches every test, so no result of the report stands',
        (_kind, path) => {
            // Given - the report of a run, no test seen spawning
            // Then - nothing is kept
            expect(keptIds([path], SPEC_QUIET)).toBeUndefined();
        },
    );

    test('staleness — reportAfter — nothing changed keeps every result, and the rest of the report as it was', () => {
        // Given - the report of a run
        // When - it is read against no change
        const report = reportAfter(REPORT, [], staleness(MODULE_TESTS));

        // Then - the same report
        expect(report).toStrictEqual(REPORT);
    });

    test('staleness — reportAfter — a new test file takes nothing out, and a report with no tests keeps its mutants', () => {
        // Given - a report with no test file and a mutant no test covers
        const bare = { files: { 'src/a.ts': { mutants: [mutant('1', [])] } } };

        // When - a test file the report never ran is added
        const report = reportAfter(bare, ['src/__tests__/new.test.ts'], staleness(MODULE_TESTS));

        // Then - the report stands
        expect(report).toStrictEqual(bare);
    });

    test('reportAfter — a changed test file is no changed source: a test the run could not follow keeps its mutants', () => {
        // Given - the report of a run, its spec not followed into its processes
        // When - a's module test changes
        const kept = keptIds(['src/__tests__/a.test.ts']);

        // Then - the mutant a's test covered goes; the spec's other mutant stays
        expect(kept).toStrictEqual({ 'src/a.ts': ['2'], 'src/b.ts': ['3'] });
    });

    test('reportAfter — a test is stale when any one of the changed sources reaches it', () => {
        // Given - the report of a run, no test seen spawning
        // When - h.ts, which b's test loads, and a new source nothing loads change together
        const kept = keptIds(['src/h.ts', 'src/new.ts'], SPEC_QUIET);

        // Then - b's mutant goes
        expect(kept).toStrictEqual({ 'src/a.ts': ['1', '2'], 'src/b.ts': [] });
    });

    test('reportAfter — a mutant a stale test killed goes, though the report lists that test only as its killer', () => {
        // Given - a report whose mutant names the spec as its killer and covers nothing
        const report = {
            files: { 'src/c.ts': { mutants: [mutant('9', [], ['1'])] } },
            testFiles: REPORT.testFiles,
        };

        // When - the spec changes
        const kept = reportAfter(report, ['specs/a.spec.ts'], staleness(MODULE_TESTS));

        // Then - the mutant is measured again
        expect(idsByFile(kept)).toStrictEqual({ 'src/c.ts': [] });
    });

    test.each([
        [
            'a kill by a test that stands stays, whatever covered it besides',
            mutant('9', ['0', '1'], ['0']),
            ['9'],
        ],
        ['a kill by any stale test goes', mutant('9', ['0', '1'], ['0', '1']), []],
        [
            'a timeout no test is named the killer of goes with a stale covering test',
            { ...mutant('9', ['0', '1']), status: 'Timeout' },
            [],
        ],
        [
            'a kill no test is named for goes with a stale covering test',
            { ...mutant('9', ['0', '1']), status: 'Killed' },
            [],
        ],
        ['a survivor goes with a stale covering test', mutant('9', ['0', '1']), []],
        [
            'a timeout goes with a stale covering test, though the test it timed out stands',
            { ...mutant('9', ['0', '1'], ['0']), status: 'Timeout' },
            [],
        ],
    ])('reportAfter — %s', (_case, one, kept) => {
        // Given - a report of one mutant the module test and the spec cover
        const report = { files: { 'src/c.ts': { mutants: [one] } }, testFiles: REPORT.testFiles };

        // When - the spec changes
        const after = reportAfter(report, ['specs/a.spec.ts'], staleness(MODULE_TESTS));

        // Then - Stryker stopped at the killer, so only a kill whose every killer stands is kept
        expect(idsByFile(after)).toStrictEqual({ 'src/c.ts': kept });
    });
});
