import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

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
            .env({ TYPESCRIPT_JOBS: '1' })
            .exec('typescript mutation --mutate src/[id]/[key].ts:2-4');

        // Then - both runs measure the guard of the bracketed file, by the whole suite it is handed to by its lines, and name its survivors at their place; each stage says how long it took on how many test runners — this gate's share of the cores, or the count asked for
        expect([
            whole.exitCode,
            ranged.exitCode,
            whole.stdout.text.includes('did not result in any files'),
            /The module tests ran in \d+\.\ds on [1-9]\d* test runner\(s\)/u.test(
                whole.stdout.text,
            ),
            /The whole suite ran in \d+\.\ds on [1-9]\d* test runner\(s\)/u.test(whole.stdout.text),
            /The module tests ran in \d+\.\ds on 1 test runner\(s\)/u.test(ranged.stdout.text),
        ]).toStrictEqual([1, 1, false, true, true, true]);
        expect(whole.stdout).toMatch(`
            {{any}}
            src/[id]/[key].ts:2:9  ConditionalExpression → false  (.artifacts/stryker/suite-report.json)
            src/[id]/[key].ts:2:9  EqualityOperator → rate >= 0.5  (.artifacts/stryker/suite-report.json)
            found: 2 mutant(s) a test runs and none detects{{any}}
        `);
        expect(ranged.stdout).toMatch(`
            {{any}}
            src/[id]/[key].ts:2:9  ConditionalExpression → false  (.artifacts/stryker/suite-report.json)
            src/[id]/[key].ts:2:9  EqualityOperator → rate >= 0.5  (.artifacts/stryker/suite-report.json)
            found: 2 mutant(s) a test runs and none detects{{any}}
        `);
    });
});
