import { describe, expect, test } from 'vitest';

import { judgedReport, verdictOf } from './mutation-survivors.js';

const mutant = (status: string, line: number, replacement = 'true') => ({
    location: { end: { column: 20, line }, start: { column: 9, line } },
    mutatorName: 'ConditionalExpression',
    replacement,
    status,
});

describe('mutation-survivors', () => {
    test('a run whose every covered mutant is detected passes, counting what no module test runs apart', () => {
        // Given - a report of two detected mutants, one no module test runs and a static one an earlier run left, beside a file an earlier run measured
        const judged = judgedReport(
            {
                files: {
                    'src/a.ts': {
                        mutants: [
                            mutant('Killed', 3),
                            mutant('Timeout', 4),
                            mutant('NoCoverage', 9),
                            { ...mutant('Survived', 1), static: true },
                        ],
                    },
                    'src/kept-from-an-earlier-run.ts': { mutants: [mutant('Survived', 1)] },
                },
            },
            new Set(['src/a.ts']),
        );

        // Then - the gate passes, and says what the specs are left to measure
        expect(verdictOf(judged)).toStrictEqual({
            lines: [
                'every mutant a module test runs is detected — 2 detected',
                "1 mutant(s) no module test runs — the specs', measured by range: typescript mutation --specs --mutate <file>:<from>-<to>",
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
                        mutants: [
                            mutant('Survived', 7),
                            mutant('Survived', 3),
                            mutant('Ignored', 1),
                        ],
                    },
                },
            },
            new Set(['src/a.ts', 'src/b.ts']),
        );

        // Then - each survivor on one line, then the four parts, then the uncovered count
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
});
