import { directory } from '@jterrazz/test';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

const CONSUMER = resolve(import.meta.dirname, '../__setup__/packed/consumer.ts');

const OUTSIDE_CI = { CI: '', TYPESCRIPT_MUTATION_COLD: '' };

// invariant: the first run of a pair is the packed command the second one runs, in a repository git can list, outside CI and with no cold run asked (a gate run cold sets both for itself), so the second inherits its report.
function measuredOnce(workdir: string): void {
    execFileSync('git', ['init', '--quiet'], { cwd: workdir });
    execFileSync('node', [CONSUMER, 'typescript', 'mutation'], {
        cwd: workdir,
        env: { ...process.env, ...OUTSIDE_CI },
        stdio: 'pipe',
    });
}

describe('mutation', () => {
    test('typescript mutation — a mutant the module test runs and none detects, and no spec detects either, fails the run, named at its place', async () => {
        // Given - a consumer installing the packed toolchain, one test leaving the guard of its source unjudged, and no spec beside it
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .exec('typescript mutation');

        // Then - the module tests hand what they let live to the whole suite, which lets it live too; each survivor is named, then the lesson, and nothing is written to a ledger
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
             TYPESCRIPT  Measuring the whole suite against what the module tests let live, and the changed lines they do not run...
            {{any}}
            src/discount.ts:2:9  ConditionalExpression → false  (.artifacts/stryker/suite-report.json)
            src/discount.ts:2:9  EqualityOperator → rate >= 0.5  (.artifacts/stryker/suite-report.json)
            found: 2 mutant(s) a test runs and none detects · why: a test that runs a line and lets a change of it pass proves nothing of that line · fix: assert what the line decides — a value compared whole kills most of them — or, where no change of the line can alter what the module does, declare it above the line: // Stryker disable next-line <mutator>: <why the mutant is equivalent> · read: docs/reference/quality-checks.md#mutation
            0 mutant(s) no test runs
            2 mutant(s) the module tests leave to the suite — none of them runs it, or only loading a module does — on lines no change has brought there; the whole suite measures them when one does

            ✗ Mutation failed — first survivor src/discount.ts:2 ConditionalExpression; 5 detected, 2 surviving, 0 never judged, over HEAD..working tree
        `);
        expect(result.file('.jterrazz/baseline.json').exists).toBe(false);
    });

    test('typescript mutation — a mutant the module test lets live that a spec detects passes the run', async () => {
        // Given - the same consumer, its module test leaving the guard unjudged, beside a spec that judges the boundary and the refusal
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-spec-answers/'))
            .exec('typescript mutation');

        // Then - the whole suite detects both, and the verdict counts them among the detected
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
             TYPESCRIPT  Measuring the whole suite against what the module tests let live, and the changed lines they do not run...
            {{any}}
            measured 7 mutants over HEAD..working tree — every mutant a test runs is detected
            2 mutant(s) the module tests let live, detected by the whole suite
            0 mutant(s) no test runs
            2 mutant(s) the module tests leave to the suite — none of them runs it, or only loading a module does — on lines no change has brought there; the whole suite measures them when one does

            ✓ Mutation passed — 7 detected, 0 surviving, 0 never judged, over HEAD..working tree
        `);
    });

    test('typescript mutation — a commit to measure from that git cannot name is refused before anything runs', async () => {
        // Given - the consumer, outside any repository, measured since a commit named on the command line, then by CI's variable
        const named = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .exec('typescript mutation --since main');
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .env({ TYPESCRIPT_MUTATION_SINCE: 'main' })
            .exec('typescript mutation');

        // Then - the four parts name the commit either way, and no run starts
        expect([named.exitCode, named.stdout.text]).toStrictEqual([1, result.stdout.text]);
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            found: git names no commit main · why: the whole suite measures the lines changed since that commit, and a run that cannot name them would pass having measured nothing · fix: name a commit this clone holds — fetch it — or leave --since and TYPESCRIPT_MUTATION_SINCE unset to measure the change not yet committed, or, on a clean tree, the branch since its merge-base with the default branch · read: docs/reference/quality-checks.md#mutation

            ✗ Mutation failed — refused before any run: git names no commit main
        `);
        expect(result.stdout.text).not.toContain('Measuring');
    });

    test('typescript mutation — a --mutate range that reaches no source is refused before anything runs', async () => {
        // Given - the consumer, measured at a path it does not hold, then at its source's lines written backwards
        const misspelled = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .exec('typescript mutation --mutate=src/discont.ts:1-5');
        const backwards = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .exec('typescript mutation --mutate src/discount.ts:9-2');

        // Then - each is refused, naming the range, and no run starts
        expect([misspelled.exitCode, backwards.exitCode]).toStrictEqual([1, 1]);
        expect(misspelled.stdout).toMatch(`
            found: --mutate names src/discont.ts:1-5, which reaches no source the run mutates · why: a range that reaches no source narrows both runs to nothing, and the run would pass having measured nothing · fix: name a source the run mutates, by its path from the project's root and its lines as from-to — src/a.ts:10-20 — or the whole file by its path · read: docs/reference/quality-checks.md#mutation

            ✗ Mutation failed — refused before any run: --mutate names src/discont.ts:1-5, which reaches no source the run mutates
        `);
        expect(backwards.stdout.text).toContain('found: --mutate names src/discount.ts:9-2,');
        expect(`${misspelled.stdout.text}${backwards.stdout.text}`).not.toContain('Measuring');
    });

    test('typescript mutation — a run whose every mutant the module tests run is detected passes', async () => {
        // Given - the same consumer, its test judging the guard, its boundary and its message, CI's variable left blank by an event that carries no commit
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .env({ TYPESCRIPT_MUTATION_SINCE: ' ' })
            .exec('typescript mutation');

        // Then - the blank variable reads as unset, so HEAD, which nothing outside a repository names; the verdict passes, the suite never started
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
             TYPESCRIPT  git names no commit HEAD: the whole suite measures nothing of this change.

            measured 9 mutants over HEAD..working tree — every mutant a test runs is detected
            0 mutant(s) no test runs

            ✓ Mutation passed — 9 detected, 0 surviving, 0 never judged, over HEAD..working tree
        `);
        expect(result.stdout.text).not.toContain('Measuring the whole suite');
    });

    test('typescript mutation — a source no module test reaches waits for a change, and the module run builds like the suite', async () => {
        // Given - the same consumer with its built, spec-proven source, outside any repository, so no change reaches it
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .fixture(directory('./__fixtures__/mutation-spec-proven/'))
            .exec('typescript mutation');

        // Then - the module tests' verdict alone, the source waiting for a change counted apart, and a module sandbox that runs the project's build, as the suite's does
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
             TYPESCRIPT  git names no commit HEAD: the whole suite measures nothing of this change.

            measured 9 mutants over HEAD..working tree — every mutant a test runs is detected
            0 mutant(s) no test runs
            1 source(s) with no module test — the whole suite measures the lines a change reaches there; what no change reaches no count holds

            ✓ Mutation passed — 9 detected, 0 surviving, 0 never judged, over HEAD..working tree
        `);
        expect(result.stdout.text).not.toContain('Measuring the whole suite');
        expect(result.file('.artifacts/stryker/sandbox.mjs').content).toContain('npm');
    });

    test('typescript mutation — the whole suite judges what only a spec proves, through the processes it spawns', async () => {
        // Given - the same consumer, beside a source no module test reaches that a spec runs from its build as a process of its own, with a name and never an empty one, the run pointed at it
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .fixture(directory('./__fixtures__/mutation-spec-proven/'))
            .exec('typescript mutation --mutate src/greeting.ts:1-3');

        // Then - the process kills the mutants of what the spec reads; the empty-name test it runs and never judges survives, and the branches it never takes are counted apart; the suite ran on the build
        expect(result.exitCode).toBe(1);
        expect(result.file('.artifacts/stryker/sandbox.suite.mjs').content).toContain(
            "execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });",
        );
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Measuring the whole suite against what the module tests let live, and the changed lines they do not run...
            {{any}}
            src/greeting.ts:3:22  ConditionalExpression → false  (.artifacts/stryker/suite-report.json)
            src/greeting.ts:3:31  StringLiteral → "Stryker was here!"  (.artifacts/stryker/suite-report.json)
            found: 2 mutant(s) a test runs and none detects · why: a test that runs a line and lets a change of it pass proves nothing of that line · fix: assert what the line decides — a value compared whole kills most of them — or, where no change of the line can alter what the module does, declare it above the line: // Stryker disable next-line <mutator>: <why the mutant is equivalent> · read: docs/reference/quality-checks.md#mutation
            2 mutant(s) no test runs
              src/greeting.ts  2
            1 source(s) with no module test — the whole suite measures the lines a change reaches there; what no change reaches no count holds

            ✗ Mutation failed — first survivor src/greeting.ts:3 ConditionalExpression; 4 detected, 2 surviving, 0 never judged, over HEAD..working tree
        `);
    });

    test('typescript mutation — a mutant that stops a test file from loading is detected', async () => {
        // Given - the consumer, its module test judging everything, beside a table read as its module loads, whose emptied table throws before the test file can load
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .fixture(directory('./__fixtures__/mutation-loading/'))
            .exec('typescript mutation');

        // Then - every mutant of the table detected, none left to the suite
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
             TYPESCRIPT  git names no commit HEAD: the whole suite measures nothing of this change.

            measured 12 mutants over HEAD..working tree — every mutant a test runs is detected
            0 mutant(s) no test runs

            ✓ Mutation passed — 12 detected, 0 surviving, 0 never judged, over HEAD..working tree
        `);
    });

    test('typescript mutation — a module-level mutant a test also runs is the module tests to answer', async () => {
        // Given - the consumer, its module test judging everything, beside a function the module calls as it loads and a test calls again, judging only the sign of what it returns
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .fixture(directory('./__fixtures__/mutation-mixed/'))
            .exec('typescript mutation');

        // Then - the mutant the test runs and lets live fails the run, though loading the module ran it too
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
            src/doubled.ts:2:12  ArithmeticOperator → value / 2  (.artifacts/stryker/suite-report.json)
            found: 1 mutant(s) a test runs and none detects{{any}}
        `);
    });

    test('typescript mutation — a commit named on the command line is the one the change is measured from, and a clean tree against it is said to have changed nothing', async () => {
        // Given - the consumer, its test judging everything, committed whole, measured since the commit it sits on
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .prepare((workdir) => {
                const git = (...args: string[]): void => {
                    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
                        cwd: workdir,
                        stdio: 'ignore',
                    });
                };
                git('init', '--quiet');
                git('add', '--all');
                git('commit', '--quiet', '--message', 'first');
            })
            .exec('typescript mutation --since HEAD');

        // Then - the note names the commit as written, and the suite measures no change
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
             TYPESCRIPT  The working tree equals HEAD: no line changed, so the whole suite measures no change — name the commit the work started from with --since to measure one.

            measured 9 mutants over HEAD..working tree — every mutant a test runs is detected
            0 mutant(s) no test runs

            ✓ Mutation passed — 9 detected, 0 surviving, 0 never judged, over HEAD..working tree
        `);
    });

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
            measured 9 mutants over HEAD..working tree — every mutant a test runs is detected
            0 mutant(s) no test runs

            ✓ Mutation passed — 9 detected, 0 surviving, 0 never judged, over HEAD..working tree
        `);
    });

    test.each([
        ['asked with --cold', 'typescript mutation --cold', OUTSIDE_CI],
        ['run in CI', 'typescript mutation', { CI: 'true' }],
    ])(
        'typescript mutation — a run %s measures every mutant again, whatever its report holds',
        async (_how, command, env) => {
            // Given - the consumer, its test judging everything, measured once
            const result = await cli
                .fixture(directory('./__fixtures__/mutation-consumer/'))
                .fixture(directory('./__fixtures__/mutation-killing/'))
                .prepare(measuredOnce)
                .env(env)
                .exec(command);

            // Then - the report is gone before Stryker starts, and the verdict is measured whole
            expect(result.exitCode).toBe(0);
            expect(result.stdout.text).toContain('No incremental result file found');
            expect(result.stdout.text).not.toContain('are reused');
        },
    );

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
            src/discount.ts:2:9  EqualityOperator → rate >= 0.5  (.artifacts/stryker/suite-report.json)
            found: 1 mutant(s) a test runs and none detects{{any}}
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
            src/discount.ts:4:9  EqualityOperator → rate >= LIMIT  (.artifacts/stryker/suite-report.json)
            found: 1 mutant(s) a test runs and none detects{{any}}
        `);
    });
});
