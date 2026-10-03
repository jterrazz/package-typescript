import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('editor', () => {
    test('oxlint started in a subfolder lints the project by its own declaration', async () => {
        // Given - a project that turns `no-debugger` off with its reason, and a source that pauses and declares a `var`
        const result = await cli
            .fixture(directory('./_fixtures/subfolder-project/'))
            .exec('node lint-from-src.mjs');

        // Then - the config is derived from its own folder, not from src/: the profile refuses the `var`, and the project's own setting lets the pause stand
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            pause.ts:2:5: Unexpected var, use let or const instead. [Error/eslint(no-var)]

            1 problem
        `);
    });
});
