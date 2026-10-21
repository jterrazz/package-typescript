import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../kinds.specification.js';

describe('platforms', () => {
    test('a api on bun fixes and checks from its declaration alone', async () => {
        // Given - an http service on bun, its app met in-process, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/api-bun/'))
            .exec(['typescript fix', 'typescript check']);

        // Then - both gestures pass, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/bun"',
        );
    });
});
