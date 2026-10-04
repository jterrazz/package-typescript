import { describe, expect, test } from 'vitest';

import { judgedRuns, leftToTheSuite, verdictOf } from './mutation-survivors.js';
import type { Changed } from './mutation-survivors.js';

const mutant = (status: string, line: number, replacement = 'true') => ({
    location: { end: { column: 20, line }, start: { column: 9, line } },
    mutatorName: 'ConditionalExpression',
    replacement,
    status,
});

const LESSON =
    'why: a test that runs a line and lets a change of it pass proves nothing of that line · fix: assert what the line decides — a value compared whole kills most of them — or, where no change of the line can alter what the module does, declare it above the line: // Stryker disable next-line <mutator>: <why the mutant is equivalent> · read: docs/reference/quality-checks.md#mutation';

const MODULE_RUN_LEAVING_THREE = {
    measured: new Set(['src/a.ts']),
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

describe('mutation-survivors', () => {
    test('a run whose every covered mutant is detected passes, counting apart what no change has brought to the suite and what the verdict cannot read', () => {
        // Given - two detected mutants and a static one the tests loading its module detect, three no module test runs, a static one they let live and one no test could be credited with, one that did not compile, one that errored and one declared, a file Stryker found nothing to mutate in, beside a file an earlier run measured
        const judged = judgedRuns({
            measured: new Set(['src/a.ts', 'src/b.ts', 'src/c.ts']),
            report: {
                files: {
                    'src/a.ts': {
                        mutants: [
                            mutant('Killed', 3),
                            mutant('Timeout', 4),
                            mutant('NoCoverage', 9),
                            mutant('Ignored', 10),
                            mutant('CompileError', 11),
                            mutant('RuntimeError', 12),
                            { ...mutant('Ignored', 1), static: true },
                            { ...mutant('Survived', 2), static: true },
                            { ...mutant('Killed', 6), static: true },
                        ],
                    },
                    'src/b.ts': { mutants: [mutant('NoCoverage', 2), mutant('NoCoverage', 5)] },
                    'src/c.ts': {},
                    'src/kept-from-an-earlier-run.ts': { mutants: [mutant('Survived', 1)] },
                },
            },
        });

        // Then - the gate passes, and says what waits for a change to reach it and what it did not judge
        expect(verdictOf(judged)).toStrictEqual({
            lines: [
                'every mutant a test runs is detected — 3 detected',
                '0 mutant(s) no test runs',
                '5 mutant(s) no module test runs, on lines no change has reached — the whole suite measures them when one does',
                '3 mutant(s) outside the verdict — CompileError 1, Ignored 1, RuntimeError 1',
            ],
            status: 0,
        });
    });

    test('a survivor fails the run, each named at its place, in file and line order, before the lesson', () => {
        // Given - survivors in two files, out of order, two on one line, one replacing a block over several lines and one whose report names neither its mutator nor its replacement
        const judged = judgedRuns({
            measured: new Set(['src/a.ts', 'src/b.ts']),
            report: {
                files: {
                    'src/b.ts': { mutants: [mutant('Survived', 2, '{}\n// more')] },
                    'src/a.ts': {
                        mutants: [
                            mutant('Survived', 7),
                            {
                                location: {
                                    end: { column: 30, line: 3 },
                                    start: { column: 24, line: 3 },
                                },
                                status: 'Survived',
                            },
                            mutant('Survived', 3),
                        ],
                    },
                },
            },
        });

        // Then - each survivor on one line, then the four parts, then the counts, and no line for what there is none of
        expect(verdictOf(judged)).toStrictEqual({
            lines: [
                'src/a.ts:3:9  ConditionalExpression → true',
                'src/a.ts:3:24   → ',
                'src/a.ts:7:9  ConditionalExpression → true',
                'src/b.ts:2:9  ConditionalExpression → {}',
                `found: 4 mutant(s) a test runs and none detects · ${LESSON}`,
                '0 mutant(s) no test runs',
            ],
            status: 1,
        });
    });

    test('a mutant the run never judged fails it, counted by status, an unknown or missing one included — a stopped run passes nothing', () => {
        // Given - a detected mutant, two a stopped run left pending, one of a status no verdict knows, one with none
        const judged = judgedRuns({
            measured: new Set(['src/a.ts']),
            report: {
                files: {
                    'src/a.ts': {
                        mutants: [
                            mutant('Killed', 1),
                            mutant('Pending', 2),
                            mutant('Pending', 3),
                            mutant('Skipped', 4),
                            {
                                location: mutant('Killed', 5).location,
                                mutatorName: 'BlockStatement',
                            },
                        ],
                    },
                },
            },
        });

        // Then - the four parts name every unjudged status, and the run fails
        expect(verdictOf(judged)).toStrictEqual({
            lines: [
                'found: 4 mutant(s) the run never judged — no status 1, Pending 2, Skipped 1 · why: a mutant no test was run against says nothing of the line it mutates, so passing it would pass a run that judged nothing there · fix: run `typescript mutation` again to its end — a run stopped midway leaves its mutants Pending, and the next one runs them · read: docs/reference/quality-checks.md#mutation',
                '0 mutant(s) no test runs',
            ],
            status: 1,
        });
    });

    test('the module tests hand the suite exactly the nodes they could not measure, on the lines the change reaches', () => {
        // Given - a module run that killed one mutant, let one survive, ran none of four — one past the hunk —, declared one, let a static one live and could credit no test with another, in a file the change rewrote at line 1 and lines 4 to 6, beside a file it added and one it left alone
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

        // Then - one range per node the change reaches, two mutants of one node measured by one, its columns counted from zero as --mutate reads them; a survivor of a line a test runs stays the module tests' to answer
        expect(
            leftToTheSuite(
                report,
                new Set(['src/a.ts', 'src/added.ts', 'src/untouched.ts']),
                changed,
            ),
        ).toStrictEqual(['src/a.ts:4:8-4:19', 'src/a.ts:6:8-6:19', 'src/added.ts:40:8-40:19']);
    });

    test('one verdict over both runs: the suite judges what the change brought it of what the module tests left, and an earlier run it reports counts for nothing', () => {
        // Given - the module tests killed one mutant and left three, the change reaching two of them and a source no module test sits beside; the suite killed one, let one survive, ran nothing of one mutant of that source, and still reports four results of an earlier run the change did not reach, one of them on a mutant the module tests left
        const suite = {
            changed: new Map<string, (readonly [number, number])[] | true>([
                ['src/a.ts', [[2, 3]]],
                ['src/specs-only.ts', [[1, 2]]],
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
                            mutant('Killed', 1),
                            mutant('NoCoverage', 2),
                            mutant('Survived', 9),
                        ],
                    },
                },
            },
        };

        // Then - three detected, the suite's survivor judged, what nothing runs counted by file, the mutant no change reached left, and neither earlier result judged
        expect(judgedRuns(MODULE_RUN_LEAVING_THREE, suite)).toStrictEqual({
            detected: 3,
            left: 1,
            outsideVerdict: {},
            survivors: [
                {
                    column: 9,
                    file: 'src/a.ts',
                    line: 3,
                    mutator: 'ConditionalExpression',
                    replacement: 'true',
                },
            ],
            uncoveredByFile: { 'src/specs-only.ts': 1 },
            unrun: {},
        });
    });

    test('a mutant the change brought to the suite that the suite reports nothing of stays left', () => {
        // Given - a mutant no module test runs, on a line the change reached, and a suite report holding nothing of it
        const judged = judgedRuns(
            {
                measured: new Set(['src/a.ts']),
                report: { files: { 'src/a.ts': { mutants: [mutant('NoCoverage', 2)] } } },
            },
            { changed: new Map([['src/a.ts', true as const]]), report: { files: {} } },
        );

        // Then - counted as left, never as judged
        expect(judged.left).toBe(1);
    });

    test('what no test runs is counted file by file, most first, a tie in name order', () => {
        // Given - the suite ran nothing of three mutants in one file, and of one in each of two others
        const judged = judgedRuns(
            { measured: new Set(), report: {} },
            {
                changed: new Map([
                    ['src/a.ts', true as const],
                    ['src/m.ts', true as const],
                    ['src/z.ts', true as const],
                ]),
                report: {
                    files: {
                        'src/z.ts': { mutants: [mutant('NoCoverage', 1)] },
                        'src/m.ts': {
                            mutants: [
                                mutant('NoCoverage', 1),
                                mutant('NoCoverage', 2),
                                mutant('NoCoverage', 3),
                            ],
                        },
                        'src/a.ts': { mutants: [mutant('NoCoverage', 1)] },
                    },
                },
            },
        );

        // Then - the total, then each file with its count
        expect(verdictOf(judged).lines).toStrictEqual([
            'every mutant a test runs is detected — 0 detected',
            '5 mutant(s) no test runs',
            '  src/m.ts  3',
            '  src/a.ts  1',
            '  src/z.ts  1',
        ]);
    });
});
