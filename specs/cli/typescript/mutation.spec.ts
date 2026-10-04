import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('mutation', () => {
    test('typescript mutation — a mutant the module test runs and none detects fails the run, named at its place', async () => {
        // Given - a consumer installing the packed toolchain, one test leaving the guard of its source unjudged
        const result = await cli
            .fixture(directory('./_fixtures/mutation-consumer/'))
            .exec('typescript mutation');

        // Then - each survivor is named, then the lesson, and nothing is written to a ledger
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Measuring the suite against mutants of the sources...
            {{any}}
            src/discount.ts:2:9  ConditionalExpression → false
            src/discount.ts:2:9  EqualityOperator → rate >= 0.5
            found: 2 mutant(s) a module test runs and none detects · why: a test that runs a line and lets a change of it pass proves nothing of that line · fix: assert what the line decides — a value compared whole kills most of them — or, where no change of the line can alter what the module does, declare it above the line: // Stryker disable next-line <mutator>: <why the mutant is equivalent> · read: docs/reference/quality-checks.md#mutation
            2 mutant(s) no module test runs — the specs', measured by range: typescript mutation --specs --mutate <file>:<from>-<to>
              src/discount.ts  2
        `);
        expect(result.file('.jterrazz/baseline.json').exists).toBe(false);
    });

    test('typescript mutation — a run whose every mutant the module tests run is detected passes', async () => {
        // Given - the same consumer, its test judging the guard, its boundary and its message
        const result = await cli
            .fixture(directory('./_fixtures/mutation-consumer/'))
            .fixture(directory('./_fixtures/mutation-killing/'))
            .exec('typescript mutation');

        // Then - the verdict passes
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Measuring the suite against mutants of the sources...
            {{any}}
            every mutant a module test runs is detected — 9 detected
            0 mutant(s) no module test runs — the specs', measured by range: typescript mutation --specs --mutate <file>:<from>-<to>
        `);
    });
});
