import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('mutation', () => {
    test('typescript mutation — a mutant the module test runs and none detects fails the run, named at its place', async () => {
        // Given - a consumer installing the packed toolchain, one test leaving the guard of its source unjudged, measured since a commit its folder, no repository, cannot name
        const result = await cli
            .fixture(directory('./_fixtures/mutation-consumer/'))
            .exec('typescript mutation --since main');

        // Then - each survivor is named, then the lesson, and nothing is written to a ledger
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
             TYPESCRIPT  git names no commit main: the whole suite measures nothing of this change.

            src/discount.ts:2:9  ConditionalExpression → false
            src/discount.ts:2:9  EqualityOperator → rate >= 0.5
            found: 2 mutant(s) a test runs and none detects · why: a test that runs a line and lets a change of it pass proves nothing of that line · fix: assert what the line decides — a value compared whole kills most of them — or, where no change of the line can alter what the module does, declare it above the line: // Stryker disable next-line <mutator>: <why the mutant is equivalent> · read: docs/reference/quality-checks.md#mutation
            0 mutant(s) no test runs
            2 mutant(s) the module tests leave to the suite — none of them runs it, or only loading a module does — on lines no change has brought there; the whole suite measures them when one does
        `);
        expect(result.file('.jterrazz/baseline.json').exists).toBe(false);
    });

    test('typescript mutation — a commit to measure from that git cannot name is refused before anything runs', async () => {
        // Given - the consumer, outside any repository, measured since a commit named on the command line, then by CI's variable
        const named = await cli
            .fixture(directory('./_fixtures/mutation-consumer/'))
            .exec('typescript mutation --since main');
        const result = await cli
            .fixture(directory('./_fixtures/mutation-consumer/'))
            .env({ TYPESCRIPT_MUTATION_SINCE: 'main' })
            .exec('typescript mutation');

        // Then - the four parts name the commit either way, and no run starts
        expect([named.exitCode, named.stdout.text]).toStrictEqual([1, result.stdout.text]);
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            found: git names no commit main · why: the whole suite measures the lines changed since that commit, and a run that cannot name them would pass having measured nothing · fix: name a commit this clone holds — fetch it, or name the merge-base with the default branch — or leave --since and TYPESCRIPT_MUTATION_SINCE unset to measure the working tree against HEAD · read: docs/reference/quality-checks.md#mutation
        `);
        expect(result.stdout.text).not.toContain('Measuring');
    });

    test('typescript mutation — a run whose every mutant the module tests run is detected passes', async () => {
        // Given - the same consumer, its test judging the guard, its boundary and its message, CI's variable left blank by an event that carries no commit
        const result = await cli
            .fixture(directory('./_fixtures/mutation-consumer/'))
            .fixture(directory('./_fixtures/mutation-killing/'))
            .env({ TYPESCRIPT_MUTATION_SINCE: ' ' })
            .exec('typescript mutation');

        // Then - the blank variable reads as unset, so HEAD, which nothing outside a repository names; the verdict passes, the suite never started
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
             TYPESCRIPT  git names no commit HEAD: the whole suite measures nothing of this change.

            every mutant a test runs is detected — 9 detected
            0 mutant(s) no test runs
        `);
        expect(result.stdout.text).not.toContain('Measuring the whole suite');
    });

    test('typescript mutation — a source no module test reaches waits for a change, and the module run builds nothing', async () => {
        // Given - the same consumer with its built, spec-proven source, outside any repository, so no change reaches it
        const result = await cli
            .fixture(directory('./_fixtures/mutation-consumer/'))
            .fixture(directory('./_fixtures/mutation-killing/'))
            .fixture(directory('./_fixtures/mutation-spec-proven/'))
            .exec('typescript mutation');

        // Then - the module tests' verdict alone, and a module sandbox that never ran the build
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
             TYPESCRIPT  git names no commit HEAD: the whole suite measures nothing of this change.

            every mutant a test runs is detected — 9 detected
            0 mutant(s) no test runs
        `);
        expect(result.stdout.text).not.toContain('Measuring the whole suite');
        expect(result.file('.artifacts/stryker/sandbox.mjs').content).not.toContain('npm');
    });

    test('typescript mutation — the whole suite judges what only a spec proves, through the processes it spawns', async () => {
        // Given - the same consumer, beside a source no module test reaches that a spec runs from its build as a process of its own, with a name and never an empty one, the run pointed at it
        const result = await cli
            .fixture(directory('./_fixtures/mutation-consumer/'))
            .fixture(directory('./_fixtures/mutation-killing/'))
            .fixture(directory('./_fixtures/mutation-spec-proven/'))
            .exec('typescript mutation --mutate src/greeting.ts');

        // Then - the process kills the mutants of what the spec reads; the empty-name test it runs and never judges survives, and the branches it never takes are counted apart; the suite ran on the build
        expect(result.exitCode).toBe(1);
        expect(result.file('.artifacts/stryker/sandbox.suite.mjs').content).toContain(
            "execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });",
        );
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Measuring the whole suite against the changed lines no module test runs...
            {{any}}
            src/greeting.ts:3:22  ConditionalExpression → false
            src/greeting.ts:3:31  StringLiteral → "Stryker was here!"
            found: 2 mutant(s) a test runs and none detects · why: a test that runs a line and lets a change of it pass proves nothing of that line · fix: assert what the line decides — a value compared whole kills most of them — or, where no change of the line can alter what the module does, declare it above the line: // Stryker disable next-line <mutator>: <why the mutant is equivalent> · read: docs/reference/quality-checks.md#mutation
            2 mutant(s) no test runs
              src/greeting.ts  2
        `);
    });

    test('typescript mutation — a mutant that stops a test file from loading is detected', async () => {
        // Given - the consumer, its module test judging everything, beside a table read as its module loads, whose emptied table throws before the test file can load
        const result = await cli
            .fixture(directory('./_fixtures/mutation-consumer/'))
            .fixture(directory('./_fixtures/mutation-killing/'))
            .fixture(directory('./_fixtures/mutation-loading/'))
            .exec('typescript mutation');

        // Then - every mutant of the table detected, none left to the suite
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
             TYPESCRIPT  git names no commit HEAD: the whole suite measures nothing of this change.

            every mutant a test runs is detected — 12 detected
            0 mutant(s) no test runs
        `);
    });

    test('typescript mutation — a module-level mutant a test also runs is the module tests to answer', async () => {
        // Given - the consumer, its module test judging everything, beside a function the module calls as it loads and a test calls again, judging only the sign of what it returns
        const result = await cli
            .fixture(directory('./_fixtures/mutation-consumer/'))
            .fixture(directory('./_fixtures/mutation-killing/'))
            .fixture(directory('./_fixtures/mutation-mixed/'))
            .exec('typescript mutation');

        // Then - the mutant the test runs and lets live fails the run, though loading the module ran it too
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
            src/doubled.ts:2:12  ArithmeticOperator → value / 2
            found: 1 mutant(s) a test runs and none detects{{any}}
        `);
    });
});
