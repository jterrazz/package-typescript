import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('domain', () => {
    test('passes a tree named for its domain, a `core/`, a `setup.ts` and a `shared/` among it', async () => {
        // Given - the tree
        const result = await lint.fixture(directory('./_fixtures/domain/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch('');
    });
});
