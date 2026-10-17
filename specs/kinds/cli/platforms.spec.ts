import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../kinds.specification.js';

describe('platforms', () => {
    test('a cli on bun fixes, builds, checks and runs its cli specs from its declaration alone', async () => {
        // Given - a command on bun, its bin built from src/, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/cli-bun/'))
            .exec(['typescript fix', 'typescript build', 'typescript check', 'vitest --run']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/bun"',
        );
    });
});
