import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../kinds.specification.js';

describe('library', () => {
    test('a library fixes, builds, checks and tests from its declaration alone', async () => {
        // Given - a library on node as a person writes it, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/library/'))
            .exec(['typescript fix', 'typescript build', 'typescript check', 'vitest --run']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/node"',
        );
    });
});
