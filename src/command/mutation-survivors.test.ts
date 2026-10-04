import { describe, expect, test } from 'vitest';

import { judgedReport, verdictOf } from './mutation-survivors.js';

const mutant = (status: string, line: number, replacement = 'true') => ({
    location: { end: { column: 20, line }, start: { column: 9, line } },
    mutatorName: 'ConditionalExpression',
    replacement,
    status,
});

describe('mutation-survivors', () => {
    test('a run whose every covered mutant is detected passes, counting apart what no module test runs, file by file, and what the verdict cannot read', () => {
        // Given - two detected mutants, three no module test runs over two files, one that did not compile, one declared, a static one an earlier run left, beside a file an earlier run measured
        const judged = judgedReport(
            {
                files: {
                    'src/a.ts': {
                        mutants: [
                            mutant('Killed', 3),
                            mutant('Timeout', 4),
                            mutant('NoCoverage', 9),
                            mutant('Ignored', 10),
                            mutant('CompileError', 11),
                            { ...mutant('Survived', 1), static: true },
                        ],
                    },
                    'src/b.ts': { mutants: [mutant('NoCoverage', 2), mutant('NoCoverage', 5)] },
                    'src/kept-from-an-earlier-run.ts': { mutants: [mutant('Survived', 1)] },
                },
            },
            new Set(['src/a.ts', 'src/b.ts']),
        );

        // Then - the gate passes, says what the specs are left to measure where, and what it did not judge
        expect(verdictOf(judged)).toStrictEqual({
            lines: [
                'every mutant a module test runs is detected — 2 detected',
                "3 mutant(s) no module test runs — the specs', measured by range: typescript mutation --specs --mutate <file>:<from>-<to>",
                '  src/b.ts  2',
                '  src/a.ts  1',
                '2 mutant(s) outside the verdict — CompileError 1, Ignored 1',
            ],
            status: 0,
        });
    });

    test('a survivor fails the run, each named at its place, in file and line order, before the lesson', () => {
        // Given - survivors in two files, out of order, one replacing a block over several lines
        const judged = judgedReport(
            {
                files: {
                    'src/b.ts': { mutants: [mutant('Survived', 2, '{}\n// more')] },
                    'src/a.ts': {
                        mutants: [mutant('Survived', 7), mutant('Survived', 3)],
                    },
                },
            },
            new Set(['src/a.ts', 'src/b.ts']),
        );

        // Then - each survivor on one line, then the four parts, then the uncovered count, and no line for statuses there are none of
        expect(verdictOf(judged)).toStrictEqual({
            lines: [
                'src/a.ts:3:9  ConditionalExpression → true',
                'src/a.ts:7:9  ConditionalExpression → true',
                'src/b.ts:2:9  ConditionalExpression → {}',
                'found: 3 mutant(s) a module test runs and none detects · why: a test that runs a line and lets a change of it pass proves nothing of that line · fix: assert what the line decides — a value compared whole kills most of them — or, where no change of the line can alter what the module does, declare it above the line: // Stryker disable next-line <mutator>: <why the mutant is equivalent> · read: docs/07-quality-checks.md#mutation',
                "0 mutant(s) no module test runs — the specs', measured by range: typescript mutation --specs --mutate <file>:<from>-<to>",
            ],
            status: 1,
        });
    });

    test('a mutant the run never judged fails it, counted by status, an unknown or missing one included — a stopped run passes nothing', () => {
        // Given - a detected mutant, two a stopped run left pending, one of a status no verdict knows, one with none
        const judged = judgedReport(
            {
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
            new Set(['src/a.ts']),
        );

        // Then - the four parts name every unjudged status, and the run fails
        expect(verdictOf(judged)).toStrictEqual({
            lines: [
                'found: 4 mutant(s) the run never judged — no status 1, Pending 2, Skipped 1 · why: a mutant no test was run against says nothing of the line it mutates, so passing it would pass a run that judged nothing there · fix: run `typescript mutation` again to its end — a run stopped midway leaves its mutants Pending, and the next one runs them · read: docs/07-quality-checks.md#mutation',
                "0 mutant(s) no module test runs — the specs', measured by range: typescript mutation --specs --mutate <file>:<from>-<to>",
            ],
            status: 1,
        });
    });
});
