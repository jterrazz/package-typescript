import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../kinds.specification.js';

describe('cli', () => {
    test('a cli fixes, builds, checks and runs its cli specs from its declaration alone', async () => {
        // Given - a command on node, its bin built from src/, both packed packages installed
        const result = await cli
            .fixture(directory('./_fixtures/cli/'))
            .exec(['typescript fix', 'typescript build', 'typescript check', 'vitest --run']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/node"',
        );
    });
});
