import { describe, expect, test } from 'vitest';

import { cli as installMatrixCli } from '../install-matrix.specification.js';

describe('install-matrix', () => {
    test('every platform installs strict and checks green', async () => {
        // Given - one consumer per profile, each installed the way pnpm installs
        const result = await installMatrixCli.exec();

        // Then - every consumer passed `typescript check`
        expect(result.exitCode).toBe(0);
        for (const consumer of ['astro', 'bun', 'expo', 'next', 'node', 'react']) {
            expect(result.stdout.text).toContain(`checked: ${consumer}`);
        }
        // value: six strict installs: four times the e2e budget.
    }, 120_000);
});
