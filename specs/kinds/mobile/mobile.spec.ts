import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../kinds.specification.js';

describe('mobile', () => {
    test('a mobile app fixes, checks and tests from its declaration alone', async () => {
        // Given - an expo app, its screens under app/, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/mobile/'))
            .exec(['typescript fix', 'typescript check', 'vitest --run']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/expo"',
        );
    });
});
