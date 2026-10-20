import { directory } from '@jterrazz/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { committed } from '../__setup__/repository.js';
import { cli } from '../packed-cli.specification.js';

const reportOf = (content: string): unknown => JSON.parse(content);

describe('mutation', () => {
    test('typescript mutation — a mutant the module test runs and none detects, and no spec detects either, fails the run, named at its place', async () => {
        // Given - a consumer installing the packed toolchain, one test leaving the guard of its source unjudged, and no spec beside it
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .exec('typescript mutation');

        // Then - the module tests hand what they let live to the whole suite, which lets it live too; each survivor is named, then the lesson, and nothing is written to a ledger
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  git names no commit HEAD: the module tests measure every source they test, whole, and the whole suite nothing of this change.
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
             TYPESCRIPT  Measuring the whole suite against what the module tests let live, and the changed lines they do not run...
            {{any}}
            src/discount.ts:2:9  ConditionalExpression: false  (.artifacts/stryker/suite-report.json)
            src/discount.ts:2:9  EqualityOperator: rate >= 0.5  (.artifacts/stryker/suite-report.json)
            found: 2 mutant(s) a test runs and none detects · why: a test that runs a line and lets a change of it pass proves nothing of that line · fix: assert what the line decides (a value compared whole kills most of them) or, where no change of the line can alter what the module does, declare it above the line: // Stryker disable next-line <mutator>: <why the mutant is equivalent> · read: docs/reference/quality-checks.md#mutation
            0 mutant(s) no test runs
            2 mutant(s) the module tests leave to the suite (none of them runs it, or only loading a module does) on lines no change has brought there; the whole suite measures them when one does

            ✗ Mutation failed: first survivor src/discount.ts:2 ConditionalExpression; 5 detected, 2 surviving, 0 never judged, over HEAD..working tree
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
             TYPESCRIPT  git names no commit HEAD: the module tests measure every source they test, whole, and the whole suite nothing of this change.
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
             TYPESCRIPT  Measuring the whole suite against what the module tests let live, and the changed lines they do not run...
            {{any}}
            measured 7 mutants over HEAD..working tree: every mutant a test runs is detected
            2 mutant(s) the module tests let live, detected by the whole suite
            0 mutant(s) no test runs
            2 mutant(s) the module tests leave to the suite (none of them runs it, or only loading a module does) on lines no change has brought there; the whole suite measures them when one does

            ✓ Mutation passed: 7 detected, 0 surviving, 0 never judged, over HEAD..working tree
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
            found: git names no commit main · why: the whole suite measures the lines changed since that commit, and a run that cannot name them would pass having measured nothing · fix: name a commit this clone holds (fetch it), or leave --since and TYPESCRIPT_MUTATION_SINCE unset to measure the change not yet committed, or, on a clean tree, the branch since its merge-base with the default branch · read: docs/reference/quality-checks.md#mutation

            ✗ Mutation failed: refused before any run: git names no commit main
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
            found: --mutate names src/discont.ts:1-5, which reaches no source the run mutates · why: a range that reaches no source narrows both runs to nothing, and the run would pass having measured nothing · fix: name a source the run mutates, by its path from the project's root and its lines as from-to (src/a.ts:10-20), or the whole file by its path · read: docs/reference/quality-checks.md#mutation

            ✗ Mutation failed: refused before any run: --mutate names src/discont.ts:1-5, which reaches no source the run mutates
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
             TYPESCRIPT  git names no commit HEAD: the module tests measure every source they test, whole, and the whole suite nothing of this change.
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
            measured 9 mutants over HEAD..working tree: every mutant a test runs is detected
            0 mutant(s) no test runs

            ✓ Mutation passed: 9 detected, 0 surviving, 0 never judged, over HEAD..working tree
        `);
        expect(result.stdout.text).not.toContain('Measuring the whole suite');
    });

    test('typescript mutation — every process a test starts finds a refusing opener first on its PATH, and BROWSER=none', async () => {
        // Given - the consumer whose every mutant is detected, beside a module test that spawns a child reading its own environment
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .fixture(directory('./__fixtures__/mutation-headless/'))
            .exec('typescript mutation');

        // Then - the child, started by a test the run started, inherited the refusing openers and no browser, so the dry run and every mutant pass it
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain(
            '✓ Mutation passed: 9 detected, 0 surviving, 0 never judged',
        );
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
             TYPESCRIPT  git names no commit HEAD: the module tests measure every source they test, whole, and the whole suite nothing of this change.
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
            measured 9 mutants over HEAD..working tree: every mutant a test runs is detected
            0 mutant(s) no test runs
            1 source(s) with no module test: the whole suite measures the lines a change reaches there; what no change reaches no count holds

            ✓ Mutation passed: 9 detected, 0 surviving, 0 never judged, over HEAD..working tree
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
            src/greeting.ts:3:22  ConditionalExpression: false  (.artifacts/stryker/suite-report.json)
            src/greeting.ts:3:31  StringLiteral: "Stryker was here!"  (.artifacts/stryker/suite-report.json)
            found: 2 mutant(s) a test runs and none detects · why: a test that runs a line and lets a change of it pass proves nothing of that line · fix: assert what the line decides (a value compared whole kills most of them) or, where no change of the line can alter what the module does, declare it above the line: // Stryker disable next-line <mutator>: <why the mutant is equivalent> · read: docs/reference/quality-checks.md#mutation
            2 mutant(s) no test runs
              src/greeting.ts  2
            1 source(s) with no module test: the whole suite measures the lines a change reaches there; what no change reaches no count holds

            ✗ Mutation failed: first survivor src/greeting.ts:3 ConditionalExpression; 4 detected, 2 surviving, 0 never judged, over HEAD..working tree
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
             TYPESCRIPT  git names no commit HEAD: the module tests measure every source they test, whole, and the whole suite nothing of this change.
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
            measured 12 mutants over HEAD..working tree: every mutant a test runs is detected
            0 mutant(s) no test runs

            ✓ Mutation passed: 12 detected, 0 surviving, 0 never judged, over HEAD..working tree
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
             TYPESCRIPT  git names no commit HEAD: the module tests measure every source they test, whole, and the whole suite nothing of this change.
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
            src/doubled.ts:2:12  ArithmeticOperator: value / 2  (.artifacts/stryker/suite-report.json)
            found: 1 mutant(s) a test runs and none detects{{any}}
            0 mutant(s) no test runs

            ✗ Mutation failed: first survivor src/doubled.ts:2 ArithmeticOperator; 10 detected, 1 surviving, 0 never judged, over HEAD..working tree
        `);
    });

    test('typescript mutation — a commit named on the command line is the one the change is measured from, and a clean tree against it is said to have changed nothing', async () => {
        // Given - the consumer, its test judging everything, committed whole, measured since the commit it sits on
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .prepare(committed)
            .exec('typescript mutation --since HEAD');

        // Then - the note names the commit as written, and neither run measures a change
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  The working tree equals HEAD: no line changed, so neither run measures a change; name the commit the work started from with --since to measure one.

            measured nothing over HEAD..working tree: no changed TypeScript source ran a mutant, or the project has none to mutate
            0 mutant(s) no test runs

            ✓ Mutation passed: 0 detected, 0 surviving, 0 never judged, over HEAD..working tree
        `);
    });

    test('typescript mutation — the module tests measure the lines the change reaches, nothing else of the source', async () => {
        // Given - the consumer, its test judging everything, committed, then the message its guard throws reworded
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .prepare((workdir) => {
                committed(workdir);
                const source = join(workdir, 'src/discount.ts');
                writeFileSync(
                    source,
                    String(readFileSync(source)).replace(
                        "'a discount above half the price'",
                        "'a discount above half the price is refused'",
                    ),
                );
            })
            .exec('typescript mutation');

        // Then - the one mutant of the reworded line is measured, and the module report holds no other
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  The change: the working tree against HEAD, the change not yet committed.
             TYPESCRIPT  Measuring the module tests against mutants of the sources they test...
            {{any}}
            measured 1 mutants over HEAD..working tree: every mutant a test runs is detected
            0 mutant(s) no test runs

            ✓ Mutation passed: 1 detected, 0 surviving, 0 never judged, over HEAD..working tree
        `);
        expect(reportOf(result.file('.artifacts/stryker/report.json').content)).toMatchObject({
            files: { 'src/discount.ts': { mutants: [{ location: { start: { line: 3 } } }] } },
        });
    });

    test('typescript mutation — glue holds a bar: a survivor in an adapter passes while the share detected reaches it, and is printed', async () => {
        // Given - the consumer, its test judging everything, beside an adapter under infrastructure/ whose test never stores a price of zero
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .fixture(directory('./__fixtures__/mutation-glue/'))
            .exec('typescript mutation');

        // Then - the run passes, says how much of the glue was detected against its bar, and names the glue survivor
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            {{any}}
            measured 18 mutants over HEAD..working tree: every domain mutant a test runs is detected, and glue holds its bar
            glue: 9 of 10 detected (90 %), its bar 90 %
              src/infrastructure/price-store.ts:6:9  EqualityOperator: cents <= 0  (.artifacts/stryker/suite-report.json)
            0 mutant(s) no test runs

            ✓ Mutation passed: 18 detected, 0 surviving, 0 never judged, over HEAD..working tree
        `);
    });

    test('typescript mutation — the same survivor in the domain fails the run', async () => {
        // Given - the same source under domain/
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .fixture(directory('./__fixtures__/mutation-glue-in-domain/'))
            .exec('typescript mutation');

        // Then - zero survivors is the domain's bar
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            {{any}}
            src/domain/price-store.ts:6:9  EqualityOperator: cents <= 0  (.artifacts/stryker/suite-report.json)
            found: 1 mutant(s) a test runs and none detects{{any}}
            0 mutant(s) no test runs

            ✗ Mutation failed: first survivor src/domain/price-store.ts:6 EqualityOperator; 18 detected, 1 surviving, 0 never judged, over HEAD..working tree
        `);
    });
});
