import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../preset-lint.specification.js';

describe('without-lint', () => {
    test('holds a tree with no lint/ folder to none of the base preset’s laws, and reports nothing', async () => {
        // Given - an application whose src/ imports only itself, with no lint/ tree for the laws to judge
        const result = await lint.fixture(directory('./_fixtures/without-lint/')).run();

        // Then - no finding: each law names a folder the tree does not hold
        expect(result.report.text).toBe('');
    });
});
