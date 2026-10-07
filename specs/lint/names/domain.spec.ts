import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('domain', () => {
    test('passes a tree named for its domain, a `core/`, a `setup.ts` and a `shared/` among it', async () => {
        // Given - folders and files named for their domain
        const result = await lint.fixture(directory('./__fixtures__/domain/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
