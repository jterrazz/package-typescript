import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('lint-built', () => {
    test('keeps lint/ on the spine where the build compiles it into what the package exports', async () => {
        // Given - a lint/ the build compiles into an entry the package exports
        const result = await lint.fixture(directory('./__fixtures__/lint-built/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
