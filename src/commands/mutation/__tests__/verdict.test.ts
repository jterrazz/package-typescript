import { describe, expect, test } from 'vitest';

import { judgedRuns } from '../survivors.js';
import { verdictOf } from '../verdict.js';

const mutant = (status: string, line: number, replacement = 'true', endLine = line) => ({
    location: { end: { column: 20, line: endLine }, start: { column: 9, line } },
    mutatorName: 'ConditionalExpression',
    replacement,
    status,
});

const LESSON =
    'why: a test that runs a line and lets a change of it pass proves nothing of that line · fix: assert what the line decides — a value compared whole kills most of them — or, where no change of the line can alter what the module does, declare it above the line: // Stryker disable next-line <mutator>: <why the mutant is equivalent> · read: docs/reference/quality-checks.md#mutation';

const NONE_RAN: ReadonlySet<string> = new Set();

const MEASURE = { range: 'a1b2c3d4..HEAD' };

describe('verdictOf', () => {
    test('a run whose every covered mutant is detected passes, counting apart what no change has brought to the suite and what the verdict cannot read', () => {
        // Given - two detected mutants and a static one the tests loading its module detect, three no module test runs, a static one they let live and one no test could be credited with, one that did not compile, one that errored and one declared, a file Stryker found nothing to mutate in, beside a file an earlier run measured
        const judged = judgedRuns({
            measured: new Set(['src/a.ts', 'src/b.ts', 'src/c.ts']),
            ranByTests: NONE_RAN,
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

        // Then - the gate passes, and says what waits for a change to reach it — two sources with no module test among it — and what it did not judge
        expect(verdictOf(judged, 2, MEASURE)).toStrictEqual({
            lines: [
                'measured 3 mutants over a1b2c3d4..HEAD — every mutant a test runs is detected',
                '0 mutant(s) no test runs',
                '5 mutant(s) the module tests leave to the suite — none of them runs it, or only loading a module does — on lines no change has brought there; the whole suite measures them when one does',
                '2 source(s) with no module test — the whole suite measures the lines a change reaches there; what no change reaches no count holds',
                '3 mutant(s) outside the verdict — CompileError 1, Ignored 1, RuntimeError 1',
            ],
            status: 0,
        });
    });

    test('a run that mutated nothing says it measured nothing over its range, never that every mutant was detected', () => {
        // Given - a report holding no mutant
        const judged = judgedRuns({ measured: new Set(), ranByTests: NONE_RAN, report: {} });

        // Then - the verdict passes, and names its range and that nothing was measured
        expect(verdictOf(judged, 0, MEASURE)).toStrictEqual({
            lines: [
                'measured nothing over a1b2c3d4..HEAD: no changed TypeScript source ran a mutant, or the project has none to mutate',
                '0 mutant(s) no test runs',
            ],
            status: 0,
        });
    });

    test('a survivor fails the run, each named at its place, in file and line order, before the lesson', () => {
        // Given - survivors in two files, out of order, two on one line, one replacing a block over several lines, one whose report names neither its mutator nor its replacement, and two static ones, the first a test also ran, the second only loading ran
        const judged = judgedRuns({
            measured: new Set(['src/a.ts', 'src/b.ts']),
            ranByTests: new Set(['ran']),
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
                            { ...mutant('Survived', 9), id: 'ran', static: true },
                            { ...mutant('Survived', 10), id: 'loaded', static: true },
                        ],
                    },
                },
            },
        });

        // Then - each survivor on one line, the static one a test ran among them, then the four parts, then the counts, and no line for what there is none of
        expect(verdictOf(judged, 0, MEASURE)).toStrictEqual({
            lines: [
                'src/a.ts:3:9  ConditionalExpression → true',
                'src/a.ts:3:24   → ',
                'src/a.ts:7:9  ConditionalExpression → true',
                'src/a.ts:9:9  ConditionalExpression → true',
                'src/b.ts:2:9  ConditionalExpression → {}',
                `found: 5 mutant(s) a test runs and none detects · ${LESSON}`,
                '0 mutant(s) no test runs',
                '1 mutant(s) the module tests leave to the suite — none of them runs it, or only loading a module does — on lines no change has brought there; the whole suite measures them when one does',
            ],
            status: 1,
        });
    });

    test('a mutant the run never judged fails it, counted by status, an unknown or missing one included — a stopped run passes nothing', () => {
        // Given - a detected mutant, two a stopped run left pending, one of a status no verdict knows, one with none
        const judged = judgedRuns({
            measured: new Set(['src/a.ts']),
            ranByTests: NONE_RAN,
            report: {
                files: {
                    'src/a.ts': {
                        mutants: [
                            mutant('Killed', 1),
                            mutant('Pending', 2),
                            mutant('Pending', 3),
                            mutant('Skipped', 4),
                            { ...mutant('Killed', 5), status: undefined },
                        ],
                    },
                },
            },
        });

        // Then - the four parts name every unjudged status, and the run fails
        expect(verdictOf(judged, 0, MEASURE)).toStrictEqual({
            lines: [
                'found: 4 mutant(s) the run never judged — no status 1, Pending 2, Skipped 1 · why: a mutant no test was run against says nothing of the line it mutates, so passing it would pass a run that judged nothing there · fix: run `typescript mutation` again to its end — a run stopped midway leaves its mutants Pending, and the next one runs them · read: docs/reference/quality-checks.md#mutation',
                '0 mutant(s) no test runs',
            ],
            status: 1,
        });
    });

    test('what no test runs is counted file by file, most first, a tie in name order', () => {
        // Given - the suite ran nothing of three mutants in one file, and of one in each of two others
        const files = ['src/a.ts', 'src/m.ts', 'src/z.ts'];
        const judged = judgedRuns(
            { measured: new Set(), ranByTests: NONE_RAN, report: {} },
            {
                changed: new Map(files.map((file) => [file, true as const])),
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
                untested: files,
            },
        );

        // Then - the total, then each file with its count
        expect(verdictOf(judged, 0, MEASURE).lines).toStrictEqual([
            'measured nothing over a1b2c3d4..HEAD: no changed TypeScript source ran a mutant, or the project has none to mutate',
            '5 mutant(s) no test runs',
            '  src/m.ts  3',
            '  src/a.ts  1',
            '  src/z.ts  1',
        ]);
    });
});
