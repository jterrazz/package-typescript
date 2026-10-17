import { describe, expect, test } from 'vitest';

import { handedToTheSuite, judgedRuns } from '../survivors.js';
import type { Changed } from '../survivors.js';
import { verdictOf } from '../verdict.js';

const mutant = (status: string, line: number, replacement = 'true', endLine = line) => ({
    location: { end: { column: 20, line: endLine }, start: { column: 9, line } },
    mutatorName: 'ConditionalExpression',
    replacement,
    status,
});

const LESSON =
    'why: a test that runs a line and lets a change of it pass proves nothing of that line · fix: assert what the line decides (a value compared whole kills most of them) or, where no change of the line can alter what the module does, declare it above the line: // Stryker disable next-line <mutator>: <why the mutant is equivalent> · read: docs/reference/quality-checks.md#mutation';

const NONE_RAN: ReadonlySet<string> = new Set();

const MEASURE = { range: 'a1b2c3d4..HEAD' };

const MODULE_RUN_LEAVING_THREE = {
    measured: new Set(['src/a.ts']),
    ranByTests: NONE_RAN,
    report: {
        files: {
            'src/a.ts': {
                mutants: [
                    mutant('Killed', 1),
                    mutant('NoCoverage', 2),
                    mutant('NoCoverage', 3),
                    mutant('NoCoverage', 4),
                ],
            },
        },
    },
};

describe('survivors', () => {
    test('the module tests hand the suite exactly the nodes they let live, wherever they stand, and those they could not measure on the lines the change reaches', () => {
        // Given - a module run that killed one mutant, let two survive (one past the hunk), ran none of four (one past the hunk), declared one, let a static one live and could credit no test with another, in a file the change rewrote at line 1 and lines 4 to 6, beside a file it added and one it left alone
        const report = {
            files: {
                'src/a.ts': {
                    mutants: [
                        mutant('Killed', 4),
                        mutant('Survived', 5),
                        mutant('NoCoverage', 3),
                        mutant('NoCoverage', 4),
                        mutant('Ignored', 5),
                        { ...mutant('Ignored', 6), static: true },
                        { ...mutant('Survived', 6, 'false'), static: true },
                        mutant('NoCoverage', 7),
                        mutant('Survived', 9),
                    ],
                },
                'src/added.ts': { mutants: [mutant('NoCoverage', 40)] },
                'src/untouched.ts': { mutants: [mutant('NoCoverage', 1)] },
            },
        };
        const changed: Changed = new Map<string, (readonly [number, number])[] | true>([
            [
                'src/a.ts',
                [
                    [1, 1],
                    [4, 6],
                ],
            ],
            ['src/added.ts', true],
        ]);

        // Then - one range per node, two mutants of one node measured by one, its columns counted from zero as --mutate reads them: each survivor, and what the change reaches of the rest
        expect(
            handedToTheSuite(
                {
                    measured: new Set(['src/a.ts', 'src/added.ts', 'src/untouched.ts']),
                    ranByTests: NONE_RAN,
                    report,
                },
                { changed },
            ),
        ).toStrictEqual([
            'src/a.ts:5:8-5:19',
            'src/a.ts:4:8-4:19',
            'src/a.ts:6:8-6:19',
            'src/a.ts:9:8-9:19',
            'src/added.ts:40:8-40:19',
        ]);
    });

    test('one verdict over both runs: the suite judges what the change brought it of what the module tests left, and an earlier run it reports counts for nothing', () => {
        // Given - the module tests killed one mutant and left three, the change reaching two of them and a source with no module test, measured over lines 10 to 12 beside a range of another source; the suite killed one, let one survive, ran nothing of one mutant of that source, and still reports six results of an earlier run this one did not measure, one of them on a mutant the module tests left and two crossing an edge of the range
        const suite = {
            changed: new Map<string, (readonly [number, number])[] | true>([
                ['src/a.ts', [[2, 3]]],
                ['src/specs-only.ts', [[10, 12]]],
            ]),
            report: {
                files: {
                    'src/a.ts': {
                        mutants: [
                            mutant('Survived', 1),
                            mutant('Killed', 2),
                            mutant('Survived', 3),
                            mutant('Survived', 4),
                        ],
                    },
                    'src/specs-only.ts': {
                        mutants: [
                            mutant('Killed', 10),
                            mutant('NoCoverage', 12),
                            mutant('Survived', 11, 'true', 15),
                            mutant('Survived', 9, 'true', 11),
                            mutant('Survived', 19),
                        ],
                    },
                },
            },
            untested: ['src/specs-else.ts:1-99', 'src/specs-only.ts:10-12'],
        };

        // Then - three detected, the suite's survivor judged, what nothing runs counted by file, the mutant no change reached left, and neither earlier result judged
        expect(judgedRuns(MODULE_RUN_LEAVING_THREE, suite)).toStrictEqual({
            detected: 3,
            detectedBySuite: 0,
            left: 1,
            outsideVerdict: {},
            survivors: [
                {
                    column: 9,
                    file: 'src/a.ts',
                    line: 3,
                    mutator: 'ConditionalExpression',
                    replacement: 'true',
                    report: '.artifacts/stryker/suite-report.json',
                },
            ],
            uncoveredByFile: { 'src/specs-only.ts': 1 },
            unrun: {},
        });
    });

    test('a mutant the module tests let live survives only where the whole suite lets it live too, and one the suite reports nothing of was judged by nothing', () => {
        // Given - four mutants the module tests ran and let live, on lines no change reached: the suite kills one, times out on one, lets one live and runs nothing of one; a fifth it reports nothing of
        const judged = judgedRuns(
            {
                measured: new Set(['src/a.ts']),
                ranByTests: NONE_RAN,
                report: {
                    files: {
                        'src/a.ts': {
                            mutants: [1, 2, 3, 4, 5].map((line) => mutant('Survived', line)),
                        },
                    },
                },
            },
            {
                changed: new Map(),
                report: {
                    files: {
                        'src/a.ts': {
                            mutants: [
                                mutant('Killed', 1),
                                mutant('Timeout', 2),
                                mutant('Survived', 3),
                                mutant('NoCoverage', 4),
                            ],
                        },
                    },
                },
                untested: [],
            },
        );

        // Then - two detected by the suite and counted so, the two it did not detect named as survivors, the one it never reported never judged
        expect(verdictOf(judged, 0, MEASURE)).toStrictEqual({
            lines: [
                'src/a.ts:3:9  ConditionalExpression: true  (.artifacts/stryker/suite-report.json)',
                'src/a.ts:4:9  ConditionalExpression: true  (.artifacts/stryker/suite-report.json)',
                `found: 2 mutant(s) a test runs and none detects · ${LESSON}`,
                'found: 1 mutant(s) the run never judged: absent from the suite report 1 · why: a mutant no test was run against says nothing of the line it mutates, so passing it would pass a run that judged nothing there · fix: run `typescript mutation` again to its end: a run stopped midway leaves its mutants Pending, and the next one runs them · read: docs/reference/quality-checks.md#mutation',
                '2 mutant(s) the module tests let live, detected by the whole suite',
                '0 mutant(s) no test runs',
            ],
            status: 1,
        });
    });

    test('a mutant the change brought to the suite that the suite reports nothing of was judged by nothing, and fails the run', () => {
        // Given - a mutant no module test runs, on a line the change reached, and a suite report holding nothing of it
        const judged = judgedRuns(
            {
                measured: new Set(['src/a.ts']),
                ranByTests: NONE_RAN,
                report: { files: { 'src/a.ts': { mutants: [mutant('NoCoverage', 2)] } } },
            },
            { changed: new Map([['src/a.ts', true as const]]), report: {}, untested: [] },
        );

        // Then - named as never judged, never counted as left, and the run fails
        expect([judged.left, judged.unrun, verdictOf(judged, 0, MEASURE).status]).toStrictEqual([
            0,
            { 'absent from the suite report': 1 },
            1,
        ]);
    });

    test('--mutate names the lines to measure and leaves a static mutant to the suite only where the tree’s own change reaches it', () => {
        // Given - a file whose module-level table line 2 and function line 9 no module test runs, the run pointed at the whole file by --mutate, and a tree whose own change touches line 9 alone
        const modules = {
            measured: new Set(['src/a.ts']),
            ranByTests: NONE_RAN,
            report: {
                files: {
                    'src/a.ts': {
                        mutants: [
                            { ...mutant('Ignored', 2), static: true },
                            mutant('NoCoverage', 9),
                        ],
                    },
                },
            },
        };
        const named: Changed = new Map([['src/a.ts', true as const]]);
        const tree: Changed = new Map([['src/a.ts', [[9, 9] as const]]]);

        // Then - the function line is handed to the suite on the named lines, the table line only where the tree changed it: here it stays left; and a tree that changed nothing leaves the function line to the named lines alone
        expect([
            handedToTheSuite(modules, { changed: named, statics: tree }),
            handedToTheSuite(modules, { changed: named }),
            handedToTheSuite(modules, { changed: named, statics: new Map() }),
        ]).toStrictEqual([
            ['src/a.ts:9:8-9:19'],
            ['src/a.ts:2:8-2:19', 'src/a.ts:9:8-9:19'],
            ['src/a.ts:9:8-9:19'],
        ]);
    });
});
