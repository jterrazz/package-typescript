import { describe, expect, test } from 'vitest';

import { originalOf } from './sandbox.js';

describe('originalOf', () => {
    test('sandbox — a path inside a mutation sandbox is read back in the project it copies', () => {
        // Given - a sandbox of a mutation run, a source copied into it, and a path outside it

        // Then - the two inside are read in the project, the third as it is
        expect(originalOf('/work/repo/.artifacts/stryker/tmp/sandbox-a1B2c3')).toBe('/work/repo');
        expect(originalOf('/work/repo/.artifacts/stryker/tmp/sandbox-a1B2c3/src/index.ts')).toBe(
            '/work/repo/src/index.ts',
        );
        expect(originalOf('/work/repo/src/index.ts')).toBe('/work/repo/src/index.ts');
    });
});
