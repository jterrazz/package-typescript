import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../kinds.specification.js';

describe('website', () => {
    test('a website fixes, checks and tests from its declaration alone', async () => {
        // Given - a react site, which its framework builds, both packed packages installed
        const result = await cli
            .fixture(directory('./_fixtures/website/'))
            .exec(['typescript fix', 'typescript check', 'vitest --run']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/react"',
        );
    });
});
