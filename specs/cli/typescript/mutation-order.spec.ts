import { directory } from '@jterrazz/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';
import { reportedMutants } from './__setup__/suite-report.js';
import type { ReportedMutant } from './__setup__/suite-report.js';

const CONSUMER = resolve(import.meta.dirname, '../__setup__/packed/consumer.ts');

const ONE_RUNNER = { TYPESCRIPT_CAPACITY: 'cpus=1,memory=64g' };

const DOUBLING = 'ArithmeticOperator amount / 2';

describe('mutation order', () => {
    test('typescript mutation — a mutant of what a command loads runs first the spec that ran its source, though the specs that only loaded it are quicker', async () => {
        // Given - a consumer whose three quick specs spawn its command and only load the label, and whose slow spec runs the command that reads it, measured at the label
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-commands/'))
            .exec('typescript mutation --mutate src/labels.ts:1-1');

        // Then - the label's mutant is credited to every spec, and detected by the first one it runs, the slow one
        expect(result.exitCode).toBe(0);
        expect(
            reportedMutants(result.file('.artifacts/stryker/suite-report.json').content),
        ).toStrictEqual({
            'src/labels.ts:1:15 StringLiteral ""': {
                coveredBy: [
                    'an unknown command prints the usage and fails',
                    'a prints a',
                    'b prints its label, the slowest spec',
                    'no command prints the usage',
                ].toSorted(),
                status: 'Killed',
                testsCompleted: 1,
            },
        });
    });

    test('typescript mutation — a mutant whose source changed runs first the spec that killed it last, though a quicker one ran its source too', async () => {
        // Given - a consumer whose quick spec runs the price at zero, which no operator tells apart, and whose slow spec runs it at three; measured once, then a comment written above the price
        let first: Record<string, ReportedMutant> = {};
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-killer/'))
            .prepare((workdir) => {
                execFileSync('git', ['init', '--quiet'], { cwd: workdir });
                execFileSync(
                    'node',
                    [CONSUMER, 'typescript', 'mutation', '--mutate', 'src/price.ts:1-1'],
                    {
                        cwd: workdir,
                        env: { ...process.env, ...ONE_RUNNER },
                        stdio: 'pipe',
                    },
                );
                first = reportedMutants(
                    readFileSync(join(workdir, '.artifacts/stryker/suite-report.json'), 'utf8'),
                );
                writeFileSync(
                    join(workdir, 'src/price.ts'),
                    `// the price doubles\n${readFileSync(join(workdir, 'src/price.ts'), 'utf8')}`,
                );
            })
            .env(ONE_RUNNER)
            .exec('typescript mutation --mutate src/price.ts:2-2');

        // Then - the first run reached the killer second, quickest first; the second runs it first, and stops there
        expect(result.exitCode).toBe(0);
        const second = reportedMutants(result.file('.artifacts/stryker/suite-report.json').content);
        expect([
            first[`src/price.ts:1:50 ${DOUBLING}`]?.testsCompleted,
            second[`src/price.ts:2:50 ${DOUBLING}`],
        ]).toStrictEqual([
            2,
            {
                coveredBy: ['nothing costs nothing', 'three costs six, the slowest spec'],
                status: 'Killed',
                testsCompleted: 1,
            },
        ]);
    });

    test('typescript mutation — the spec that killed the latest mutants of a source runs first for the next one, though a quicker spec covers it too', async () => {
        // Given - a consumer whose quick spec runs the label and judges nothing, and whose slow spec tells every mutant of it apart, measured cold on one test runner
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-order-recent/'))
            .env(ONE_RUNNER)
            .exec('typescript mutation --mutate src/label.ts:1-1');

        // Then - every mutant is killed; the first reached the slow spec second, every later one ran it first and stopped there
        expect(result.exitCode).toBe(0);
        const mutants = Object.values(
            reportedMutants(result.file('.artifacts/stryker/suite-report.json').content),
        );
        expect(mutants.map(({ status }) => status)).toStrictEqual(mutants.map(() => 'Killed'));
        expect(
            mutants.map(({ testsCompleted }) => testsCompleted).toSorted((a, b) => a - b),
        ).toStrictEqual([...mutants.slice(1).map(() => 1), 2]);
    });

    test('typescript mutation — a spec a stopped run skipped keeps its place for the next mutant, where the project keeps its worker', async () => {
        // Given - a consumer whose project keeps its worker, a quick spec and a slow one that judge nothing and a middle one that tells both numbers apart, measured cold on one test runner at both numbers
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-order-frozen/'))
            .env(ONE_RUNNER)
            .exec('typescript mutation --mutate src/first.ts:1-1,src/second.ts:1-1');

        // Then - each mutant is killed by the middle spec, reached second, the slow spec its first run skipped never run ahead of it
        expect(result.exitCode).toBe(0);
        const mutants = Object.values(
            reportedMutants(result.file('.artifacts/stryker/suite-report.json').content),
        );
        expect(
            mutants.map(({ coveredBy, status, testsCompleted }) => ({
                covered: coveredBy.length,
                status,
                testsCompleted,
            })),
        ).toStrictEqual([
            { covered: 3, status: 'Killed', testsCompleted: 2 },
            { covered: 3, status: 'Killed', testsCompleted: 2 },
        ]);
    });
});
