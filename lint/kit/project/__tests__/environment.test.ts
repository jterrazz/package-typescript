import process from 'node:process';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { withEnvironment } from '../environment.js';

const FIRST = 'ENVIRONMENT_TEST_FIRST';

const SECOND = 'ENVIRONMENT_TEST_SECOND';

function variablesAre(first: string | undefined, second: string | undefined): void {
    vi.stubEnv(FIRST, first);
    vi.stubEnv(SECOND, second);
    onTestFinished(() => {
        vi.unstubAllEnvs();
    });
}

describe('environment', () => {
    test('withEnvironment — the run reads every value set and none taken away; each variable is given back as it was, unset or set', async () => {
        // Given - one variable unset and one set, around a run that sets the first and takes the second away
        variablesAre(undefined, 'kept');
        const read = await withEnvironment({ [FIRST]: 'handed', [SECOND]: undefined }, async () => {
            await Promise.resolve();

            return [process.env[FIRST], SECOND in process.env];
        });

        // Then - the run read the first and not the second, and after it the first is unset and the second set again
        expect([read, FIRST in process.env, process.env[SECOND]]).toStrictEqual([
            ['handed', false],
            false,
            'kept',
        ]);
    });

    test('withEnvironment — a run that fails reaches the caller, its variables given back all the same', async () => {
        // Given - a variable set, around a run that replaces it and fails
        variablesAre('before', undefined);
        const failed = withEnvironment({ [FIRST]: 'during', [SECOND]: 'during' }, async () => {
            await Promise.resolve();
            throw new Error('stopped');
        });

        // Then - the failure reaches the caller, and both variables are as they were
        await expect(failed).rejects.toThrow('stopped');
        expect([process.env[FIRST], SECOND in process.env]).toStrictEqual(['before', false]);
    });
});
