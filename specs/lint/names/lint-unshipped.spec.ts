import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('lint-unshipped', () => {
    test('refuses a lint/ the build compiles into an output the package does not publish', async () => {
        // Given - a lint/ the build compiles into an output the package never publishes
        const result = await lint.fixture(directory('./_fixtures/lint-unshipped/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            lint/:1:1  names(no-undeclared-root-folder)
                found: \`lint/\` holds the lint rules a package ships, and neither package.json nor its build publishes it
                why: Every root folder is on the spine, imposed by a tool, or declared with its reason.
                fix: ship it, or move it under src/
                read: docs/07-quality-checks.md#a-root-beside-the-spine
        `);
    });
});
