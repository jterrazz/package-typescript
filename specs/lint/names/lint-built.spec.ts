import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('lint-built', () => {
    test('keeps lint/ on the spine where the build compiles it into what the package exports', async () => {
        // Given - the tree
        const result = await lint.fixture(directory('./_fixtures/lint-built/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch('');
    });
});
