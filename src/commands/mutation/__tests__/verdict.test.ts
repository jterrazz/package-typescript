import { describe, expect, test } from 'vitest';

import { judgedRuns } from '../survivors.js';
import { measureOf, verdictOf } from '../verdict.js';

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

describe('verdict', () => {
    test('verdictOf — a run whose every covered mutant is detected passes, counting apart what no change has brought to the suite and what the verdict cannot read', () => {
        // Given - two detected mutants and a static one the tests loading its module detect, three no module test runs, a static one they let live and one no test could be credited with, one that did not compile, one that errored and one declared, a file Stryker found nothing to mutate in, beside a file an earlier run measured
        const judged = judgedRuns({
            measured: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
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

        // Then - the gate passes, and says what waits for a change to reach it (two sources with no module test among it) and what it did not judge
        expect(verdictOf(judged, 2, MEASURE)).toStrictEqual({
            lines: [
                'measured 3 mutants over a1b2c3d4..HEAD: every mutant a test runs is detected',
                '0 mutant(s) no test runs',
                '5 mutant(s) the module tests leave to the suite (none of them runs it, or only loading a module does) on lines no change has brought there; the whole suite measures them when one does',
                '2 source(s) with no module test: the whole suite measures the lines a change reaches there; what no change reaches no count holds',
                '3 mutant(s) outside the verdict: CompileError 1, Ignored 1, RuntimeError 1',
            ],
            status: 0,
        });
    });

    test('verdictOf — a run that mutated nothing says it measured nothing over its range, never that every mutant was detected', () => {
        // Given - a report holding no mutant
        const judged = judgedRuns({ measured: [], ranByTests: NONE_RAN, report: {} });

        // Then - the verdict passes, and names its range and that nothing was measured
        expect(verdictOf(judged, 0, MEASURE)).toStrictEqual({
            lines: [
                'measured nothing over a1b2c3d4..HEAD: no changed TypeScript source ran a mutant, or the project has none to mutate',
                '0 mutant(s) no test runs',
            ],
            status: 0,
        });
    });

    test('verdictOf — a survivor fails the run, each named at its place, in file and line order, before the lesson', () => {
        // Given - survivors in two files, out of order, two on one line, one replacing a block over several lines, one whose report names neither its mutator nor its replacement, and two static ones, the first a test also ran, the second only loading ran
        const judged = judgedRuns({
            measured: ['src/a.ts', 'src/b.ts'],
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
                'src/a.ts:3:9  ConditionalExpression: true  (.artifacts/stryker/report.json)',
                'src/a.ts:3:24  :   (.artifacts/stryker/report.json)',
                'src/a.ts:7:9  ConditionalExpression: true  (.artifacts/stryker/report.json)',
                'src/a.ts:9:9  ConditionalExpression: true  (.artifacts/stryker/report.json)',
                'src/b.ts:2:9  ConditionalExpression: {}  (.artifacts/stryker/report.json)',
                `found: 5 mutant(s) a test runs and none detects · ${LESSON}`,
                '0 mutant(s) no test runs',
                '1 mutant(s) the module tests leave to the suite (none of them runs it, or only loading a module does) on lines no change has brought there; the whole suite measures them when one does',
            ],
            status: 1,
        });
    });

    test('verdictOf — a mutant the run never judged fails it, counted by status, an unknown or missing one included — a stopped run passes nothing', () => {
        // Given - a detected mutant, two a stopped run left pending, one of a status no verdict knows, one with none
        const judged = judgedRuns({
            measured: ['src/a.ts'],
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
                'found: 4 mutant(s) the run never judged: no status 1, Pending 2, Skipped 1 · why: a mutant no test was run against says nothing of the line it mutates, so passing it would pass a run that judged nothing there · fix: run `typescript mutation` again to its end: a run stopped midway leaves its mutants Pending, and the next one runs them · read: docs/reference/quality-checks.md#mutation',
                '0 mutant(s) no test runs',
            ],
            status: 1,
        });
    });

    test('verdictOf — what no test runs is counted file by file, most first, a tie in name order', () => {
        // Given - the suite ran nothing of three mutants in one file, and of one in each of two others
        const files = ['src/a.ts', 'src/m.ts', 'src/z.ts'];
        const judged = judgedRuns(
            { measured: [], ranByTests: NONE_RAN, report: {} },
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

    test('verdictOf — what only a browser could run is unmeasured, apart from what no test runs', () => {
        // Given - the suite ran nothing of a server module's two mutants, a component's three and a template's one
        const files = ['src/server.ts', 'src/Card.tsx', 'src/page.astro'];
        const judged = judgedRuns(
            { measured: [], ranByTests: NONE_RAN, report: {} },
            {
                changed: new Map(files.map((file) => [file, true as const])),
                report: {
                    files: {
                        'src/server.ts': {
                            mutants: [mutant('NoCoverage', 1), mutant('NoCoverage', 2)],
                        },
                        'src/Card.tsx': {
                            mutants: [
                                mutant('NoCoverage', 1),
                                mutant('NoCoverage', 2),
                                mutant('NoCoverage', 3),
                            ],
                        },
                        'src/page.astro': { mutants: [mutant('NoCoverage', 1)] },
                    },
                },
                untested: files,
            },
        );

        // Then - the server's count stands alone, and the browser side is named unmeasured, file by file
        expect(verdictOf(judged, 0, MEASURE).lines).toStrictEqual([
            'measured nothing over a1b2c3d4..HEAD: no changed TypeScript source ran a mutant, or the project has none to mutate',
            '2 mutant(s) no test runs',
            '  src/server.ts  2',
            'unmeasured: 4 mutant(s) of browser-side sources: the mutation run starts no browser project, so no count claims them detected',
            '  src/Card.tsx  3',
            '  src/page.astro  1',
        ]);
    });

    test('verdictOf — a verdict narrower than the branch names the commits it did not measure, once, after the verdict and before the counts, whatever it concludes', () => {
        // Given - a run that mutated one detected mutant, one that left a survivor, both over a scope that leaves the branch's own commits out
        const narrower = { range: 'HEAD..working tree', unmeasured: 'a1b2c3d4..HEAD' };
        const passed = judgedRuns({
            measured: ['src/a.ts'],
            ranByTests: NONE_RAN,
            report: { files: { 'src/a.ts': { mutants: [mutant('Killed', 3)] } } },
        });
        const failed = judgedRuns({
            measured: ['src/a.ts'],
            ranByTests: NONE_RAN,
            report: { files: { 'src/a.ts': { mutants: [mutant('Survived', 3)] } } },
        });
        const WARNING =
            'warning: this verdict is narrower than the branch: a1b2c3d4..HEAD is not measured; commit the work and run again, or name the base with --since to measure the branch';

        // Then - the warning follows the verdict line and the lesson, and a scope that leaves nothing out prints none
        expect(verdictOf(passed, 0, narrower).lines).toStrictEqual([
            'measured 1 mutants over HEAD..working tree: every mutant a test runs is detected',
            WARNING,
            '0 mutant(s) no test runs',
        ]);
        expect(verdictOf(failed, 0, narrower).lines).toStrictEqual([
            'src/a.ts:3:9  ConditionalExpression: true  (.artifacts/stryker/report.json)',
            `found: 1 mutant(s) a test runs and none detects · ${LESSON}`,
            WARNING,
            '0 mutant(s) no test runs',
        ]);
        expect(verdictOf(passed, 0, MEASURE).lines).toStrictEqual([
            'measured 1 mutants over a1b2c3d4..HEAD: every mutant a test runs is detected',
            '0 mutant(s) no test runs',
        ]);
    });

    test('verdictOf — measureOf — keeps the range of a base and the commits it leaves out, and nothing else of it', () => {
        // Given - a base naming its commit, how it is named, its range and what it leaves out
        const base = {
            commit: 'a1b2c3d4',
            names: 'the commit before HEAD',
            range: 'a1b2c3d4..HEAD',
            unmeasured: 'e5f6a7b8..a1b2c3d4',
        };

        // Then - the range and the unmeasured commits alone
        expect(measureOf(base)).toStrictEqual({
            range: 'a1b2c3d4..HEAD',
            unmeasured: 'e5f6a7b8..a1b2c3d4',
        });
    });
});
