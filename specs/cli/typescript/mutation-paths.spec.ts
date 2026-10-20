import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

const STAGES_IN_ORDER =
    /^ TYPESCRIPT {2}The module tests ran in \d+\.\ds on [1-9]\d* test runner\(s\)$[\s\S]*^ TYPESCRIPT {2}Measuring the whole suite[\s\S]*^ TYPESCRIPT {2}The whole suite ran in \d+\.\ds on [1-9]\d* test runner\(s\)$/mu;

describe('mutation-paths', () => {
    test('typescript mutation — a source named in brackets is mutated, whole and by its lines', async () => {
        // Given - the consumer, its test judging everything, beside a route-shaped source in brackets whose test leaves its guard unjudged
        const whole = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .fixture(directory('./__fixtures__/mutation-bracketed/'))
            .exec('typescript mutation');
        const ranged = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .fixture(directory('./__fixtures__/mutation-bracketed/'))
            .env({ TYPESCRIPT_CAPACITY: 'cpus=1,memory=64g' })
            .exec('typescript mutation --mutate src/[id]/[key].ts:2-4');

        // Then - both runs measure the guard of the bracketed file, by the whole suite it is handed to by its lines, and name its survivors at their place; each stage says how long it took on how many test runners (what the capacity it is given holds)
        expect([
            whole.exitCode,
            ranged.exitCode,
            whole.stdout.text.includes('did not result in any files'),
            STAGES_IN_ORDER.test(whole.stdout.text),
            /The module tests ran in \d+\.\ds on 1 test runner\(s\)/u.test(ranged.stdout.text),
        ]).toStrictEqual([1, 1, false, true, true]);
        expect(whole.stdout).toMatch(`
            {{any}}
            src/[id]/[key].ts:2:9  ConditionalExpression: false  (.artifacts/stryker/suite-report.json)
            src/[id]/[key].ts:2:9  EqualityOperator: rate >= 0.5  (.artifacts/stryker/suite-report.json)
            found: 2 mutant(s) a test runs and none detects{{any}}
            0 mutant(s) no test runs
            2 mutant(s) the module tests leave to the suite (none of them runs it, or only loading a module does) on lines no change has brought there; the whole suite measures them when one does

            ✗ Mutation failed: first survivor src/[id]/[key].ts:2 ConditionalExpression; 14 detected, 2 surviving, 0 never judged, over HEAD..working tree
        `);
        expect(ranged.stdout).toMatch(`
            {{any}}
            src/[id]/[key].ts:2:9  ConditionalExpression: false  (.artifacts/stryker/suite-report.json)
            src/[id]/[key].ts:2:9  EqualityOperator: rate >= 0.5  (.artifacts/stryker/suite-report.json)
            found: 2 mutant(s) a test runs and none detects{{any}}
            2 mutant(s) no test runs
              src/[id]/[key].ts  2

            ✗ Mutation failed: first survivor src/[id]/[key].ts:2 ConditionalExpression; 2 detected, 2 surviving, 0 never judged, over HEAD..working tree
        `);
    });
});
