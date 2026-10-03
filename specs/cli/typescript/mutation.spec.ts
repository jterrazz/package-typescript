import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('mutation', () => {
    test('typescript mutation — a first run records the score it reached as the floor', async () => {
        // Given - a consumer installing the packed toolchain, one test leaving the guard of its source unjudged
        const result = await cli
            .fixture(directory('./_fixtures/mutation-consumer/'))
            .exec('typescript mutation');

        // Then - the run passes and writes its score to the ledger
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain(
            '.jterrazz/baseline.json › typescript.mutation › score recorded at 55.55',
        );
        expect(JSON.parse(result.file('.jterrazz/baseline.json').content)).toStrictEqual({
            'typescript.mutation': { score: 55.55 },
        });
    });

    test('typescript mutation — a score below the committed floor fails the run and keeps the floor', async () => {
        // Given - the same consumer, its ledger holding a floor of 90
        const result = await cli
            .fixture(directory('./_fixtures/mutation-consumer/'))
            .fixture(directory('./_fixtures/mutation-floor-above/'))
            .exec('typescript mutation');

        // Then - the run fails with the lesson, and the floor is not lowered
        expect(result.exitCode).toBe(1);
        expect(result.stdout.text).toContain(
            'found: `score` fell to 55.55, below its floor of 90.00 · why: a floor only rises, so what the project reached is never lost unseen · fix: raise it back, or lower the floor by hand in a commit that says why · read: docs/07-quality-checks.md#the-mutation-floor',
        );
        expect(JSON.parse(result.file('.jterrazz/baseline.json').content)).toStrictEqual({
            'typescript.mutation': { score: 90 },
        });
    });
});
