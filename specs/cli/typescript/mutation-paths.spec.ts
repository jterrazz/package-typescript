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
            .exec('typescript mutation --mutate src/[id]/[key].ts:2-4');

        // Then - both runs measure the guard of the bracketed file, by the whole suite it is handed to by its lines, and name its survivors at their place
        expect([whole.exitCode, ranged.exitCode]).toStrictEqual([1, 1]);
        expect(whole.stdout.text).not.toContain('did not result in any files');
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
