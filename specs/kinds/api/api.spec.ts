import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../kinds.specification.js';

describe('api', () => {
    test('an api fixes, builds, checks and runs its api specs from its declaration alone', async () => {
        // Given - an http service on node, its app met in-process, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/api/'))
            .exec(['typescript fix', 'typescript build', 'typescript check', 'vitest --run']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/node"',
        );
    });
});
