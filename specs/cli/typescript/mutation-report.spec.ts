import { directory } from '@jterrazz/test';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

const CONSUMER = resolve(import.meta.dirname, '../__setup__/packed/consumer.ts');

const OUTSIDE_CI = { CI: '' };

// invariant: the first run of a pair is the packed command the second one runs, in a repository git can list, outside CI, so the second inherits its report; the proof of its green is removed, so the second runs on the report as a host that restored no proof does.
function measuredOnce(workdir: string): void {
    execFileSync('git', ['init', '--quiet'], { cwd: workdir });
    execFileSync('node', [CONSUMER, 'typescript', 'mutation'], {
        cwd: workdir,
        env: { ...process.env, ...OUTSIDE_CI },
        stdio: 'pipe',
    });
    rmSync(join(workdir, '.artifacts/proven'), { force: true, recursive: true });
}

describe('mutation report', () => {
    test('typescript mutation — a run on the tree its report was measured on measures no mutant again', async () => {
        // Given - the consumer, its test judging everything, measured once
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .prepare(measuredOnce)
            .env(OUTSIDE_CI)
            .exec('typescript mutation');

        // Then - every result of the report is reused, and the verdict is the first run's
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('9 of 9 mutant result(s) are reused.');
        expect(result.stdout).toMatch(`
            {{any}}
            measured 9 mutants over HEAD..working tree: every mutant a test runs is detected
            0 mutant(s) no test runs

            ✓ Mutation passed: 9 detected, 0 surviving, 0 never judged, over HEAD..working tree
        `);
    });

    test("typescript mutation — a run leaves the JSON report alone, and --report html adds Stryker's HTML report beside it", async () => {
        // Given - the consumer, its test judging everything, measured once with no report asked
        const leftByDefault: boolean[] = [];
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .prepare((workdir) => {
                measuredOnce(workdir);
                leftByDefault.push(
                    existsSync(join(workdir, '.artifacts/stryker/report.json')),
                    existsSync(join(workdir, '.artifacts/stryker/report.html')),
                );
            })
            .env(OUTSIDE_CI)
            .exec('typescript mutation --report html');

        // Then - the first run left its JSON report and no HTML one; the run asked for it writes it, its results reused
        expect(leftByDefault).toStrictEqual([true, false]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('9 of 9 mutant result(s) are reused.');
        expect(result.file('.artifacts/stryker/report.html').content).toContain(
            '<mutation-test-report-app',
        );
    });

    test('typescript mutation — a run asked with --cold measures every mutant again, whatever its report holds', async () => {
        // Given - the consumer, its test judging everything, measured once
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .prepare(measuredOnce)
            .env(OUTSIDE_CI)
            .exec('typescript mutation --cold');

        // Then - the report is gone before Stryker starts, the verdict is measured whole, and no record of what the tests ran is left
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('No incremental result file found');
        expect(result.stdout.text).not.toContain('are reused');
        const left = await result.directory('.artifacts/stryker').files();
        expect(
            left.filter((path) => /(?:in-process|observed-tests|ran-by-tests)-/u.test(path)),
        ).toStrictEqual([]);
    });

    test('typescript mutation — a run in CI reuses what its report leaves standing, as a run on a laptop does', async () => {
        // Given - the consumer, its test judging everything, measured once, then run where CI is set
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .prepare(measuredOnce)
            .env({ CI: 'true' })
            .exec('typescript mutation');

        // Then - every result is reused
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('9 of 9 mutant result(s) are reused.');
    });

    test('typescript mutation — a report whose install changed since, as a cache restored from another lockfile carries, measures every mutant again', async () => {
        // Given - the consumer, its test judging everything, measured once, then its install laid from another lockfile
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .prepare((workdir) => {
                measuredOnce(workdir);
                appendFileSync(join(workdir, 'node_modules/.package-lock.json'), '\n');
            })
            .env({ CI: 'true' })
            .exec('typescript mutation');

        // Then - no result of the report stands
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).not.toContain('are reused');
    });

    test('typescript mutation — a change to a source no test loads keeps every result of the report', async () => {
        // Given - the consumer, its test judging everything, beside a source nothing imports, measured once, then that source changed
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .prepare((workdir) => {
                writeFileSync(join(workdir, 'src/unrelated.ts'), 'export const UNRELATED = 1;\n');
                measuredOnce(workdir);
                writeFileSync(join(workdir, 'src/unrelated.ts'), 'export const UNRELATED = 2;\n');
            })
            .env(OUTSIDE_CI)
            .exec('typescript mutation');

        // Then - the module test, seen spawning nothing and importing only the discount, keeps every result
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('9 of 9 mutant result(s) are reused.');
    });

    test('typescript mutation — a change in a covering test measures again the mutants it covered', async () => {
        // Given - the consumer, its test judging everything, measured once, then its test of the boundary dropped
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .prepare((workdir) => {
                measuredOnce(workdir);
                writeFileSync(
                    join(workdir, 'src/__tests__/discount.test.ts'),
                    `import { expect, test } from 'vitest';

import { discounted } from '../discount.js';

test('a discount takes its rate off the price', () => {
    expect(discounted(200, 0.25)).toBe(150);
});

test('a discount above half the price is refused', () => {
    expect(() => discounted(100, 0.75)).toThrow('a discount above half the price');
});
`,
                );
            })
            .env(OUTSIDE_CI)
            .exec('typescript mutation');

        // Then - the boundary the dropped test judged is measured again, and survives
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            {{any}}
            src/discount.ts:2:9  EqualityOperator: rate >= 0.5  (.artifacts/stryker/suite-report.json)
            found: 1 mutant(s) a test runs and none detects{{any}}
            0 mutant(s) no test runs

            ✗ Mutation failed: first survivor src/discount.ts:2 EqualityOperator; 8 detected, 1 surviving, 0 never judged, over HEAD..working tree
        `);
    });

    test('typescript mutation — a change in a module the covering test loads measures again what it covered, though neither the source nor the test changed', async () => {
        // Given - the consumer whose guard reads its limit from a module of its own, measured once, then that limit moved past the rate the test judges the boundary at
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .fixture(directory('./__fixtures__/mutation-limit/'))
            .prepare((workdir) => {
                measuredOnce(workdir);
                writeFileSync(join(workdir, 'src/limit.ts'), 'export const LIMIT = 0.6;\n');
            })
            .env(OUTSIDE_CI)
            .exec('typescript mutation');

        // Then - the guard's mutants are measured again, and the boundary the test no longer reaches survives, as a cold run finds it
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            {{any}}
            src/discount.ts:4:9  EqualityOperator: rate >= LIMIT  (.artifacts/stryker/suite-report.json)
            found: 1 mutant(s) a test runs and none detects{{any}}
            0 mutant(s) no test runs
            1 source(s) with no module test: the whole suite measures the lines a change reaches there; what no change reaches no count holds

            ✗ Mutation failed: first survivor src/discount.ts:4 EqualityOperator; 8 detected, 1 surviving, 0 never judged, over HEAD..working tree
        `);
    });
});
