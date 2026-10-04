import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../kinds.specification.js';

describe('workspace', () => {
    test('a workspace fixes and checks every member from its root, and each member builds and tests', async () => {
        // Given - a workspace whose one member is a library on node, both packed packages installed
        const result = await cli
            .fixture(directory('./_fixtures/workspace/'))
            .exec(['typescript fix', 'npm run build', 'typescript check', 'npm test']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').exists).toBe(false);
        expect(result.file('packages/greeting/tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/node"',
        );
    });
});
