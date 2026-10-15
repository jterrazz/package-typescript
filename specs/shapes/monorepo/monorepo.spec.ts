import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../shapes.specification.js';

describe('monorepo', () => {
    test('a monorepo fixes and checks every member from its root, which declares no kind, and each member builds and tests', async () => {
        // Given - a root listing its members in `workspaces`, with no settings of its own, whose one member is a library on node, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/monorepo/'))
            .exec(['typescript fix', 'npm run build', 'typescript check', 'npm test']);

        // Then - every gesture passes, and the editor files derive from what each member declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').exists).toBe(false);
        expect(result.file('packages/greeting/tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/node"',
        );
    });
});
