import { describe, expect, test } from 'vitest';

import { cli as installMatrixCli } from '../install-matrix.specification.js';

// The profile a consumer is for is its directory name up to the first hyphen: a new profile earns one by existing.

describe('install-matrix', () => {
    test('every profile installs strict and checks green', async () => {
        // Given - one consumer per profile, each installed the way pnpm installs
        const result = await installMatrixCli.exec();

        // Then - every consumer passed `typescript check`
        expect(result.exitCode).toBe(0);
        for (const consumer of [
            'astro',
            'bun',
            'expo',
            'next',
            'node',
            'node-published',
            'react',
        ]) {
            expect(result.stdout.text).toContain(`checked: ${consumer}`);
        }
        // Seven strict installs: four times the e2e budget.
    }, 120_000);
});
