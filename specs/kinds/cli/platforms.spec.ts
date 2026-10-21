import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../kinds.specification.js';

describe('platforms', () => {
    test('a cli on bun fixes, builds and checks from its declaration alone', async () => {
        // Given - a command on bun, its bin built from src/, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/cli-bun/'))
            .exec(['typescript fix', 'typescript build', 'typescript check']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/bun"',
        );
    });

    test('a private cli whose product is a Go program fixes and checks from its declaration alone', async () => {
        // Given - a Go module driven by a TypeScript suite, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/cli-go/'))
            .exec(['typescript fix', 'typescript check']);

        // Then - both gestures pass
        expect(result.exitCode).toBe(0);
    });
});
