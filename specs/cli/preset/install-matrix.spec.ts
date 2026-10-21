import { describe, expect, test } from 'vitest';

import { cli as installMatrixCli } from '../install-matrix.specification.js';

describe('install-matrix', () => {
    test('every platform installs strict and checks green', async () => {
        // Given - one consumer per profile, each installed the way pnpm installs, every one rendering JSX holding a .tsx that does
        const result = await installMatrixCli.exec();

        // Then - every consumer passed `typescript check`
        expect(result.exitCode).toBe(0);
        expect(
            ['astro', 'browser', 'bun', 'expo', 'next', 'node', 'react'].filter(
                (consumer) => !result.stdout.text.includes(`checked: ${consumer}`),
            ),
        ).toStrictEqual([]);
        // value: seven strict installs: four times the e2e budget.
    }, 120_000);
});
