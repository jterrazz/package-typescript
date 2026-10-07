import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { cli } from '../cli.specification.js';

describe('wrapper-unwritable', () => {
    test('refuses in four parts, fails, and removes the wrapper it wrote before the failed write', async () => {
        // Given - a clean tree, a root config over a nested one, where a directory holds the nested wrapper's path
        // When - the fix runs
        const fixed = await cli
            .env(onlyPasses('oxlint'))
            .fixture(directory('./__fixtures__/wrapper-unwritable/'))
            .exec('fix');

        // Then - the pass fails on the refusal, and the root's wrapper written first is gone
        expect(fixed.exitCode).toBe(1);
        expect(fixed.stdout.text).toContain('found: the fix wrapper could not be written');
        expect(fixed.stdout.text).toContain('✗ Some checks failed');
        expect(fixed.file('oxlint.fix.config.mjs').exists).toBe(false);
    });
});
