import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../architecture-lint.specification.js';

describe('uncruised', () => {
    test('leaves out the ground of a module test when it cruises the module graph', async () => {
        // Given - a module graph whose only crossing of the layer map sits in the ground a module test reads
        const result = await lint.fixture(directory('./__fixtures__/uncruised/')).run();

        // Then - the ground is no source of the project, so nothing is reported
        expect(result.report).toMatch('');
    });
});
