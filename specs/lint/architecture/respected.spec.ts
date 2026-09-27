import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../architecture-lint.specification.js';

describe('respected', () => {
    test('passes a module graph that keeps to the layer map the project declared', async () => {
        // Given - the tree
        const result = await lint.fixture(directory('./_fixtures/respected/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch('');
    });
});
