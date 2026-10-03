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
                why: Every root folder is on the root spine, imposed by a tool, or declared with its reason.
                fix: ship it, or move it under src/
                read: docs/07-quality-checks.md#a-root-beside-the-spine
            lint/catalog.ts:1:1  names(lint-root-holds-only-entries)
                found: \`lint/catalog.ts\` sits at the root of lint/, and is no entry
                why: lint/ has one tree in every repository — its root holds the entries alone, each \`index[.<name>].ts\` built as a subpath the package publishes or a private import, where consumer/ meets kit/, and a folder names the audience of every other file
                fix: move it into the folder its audience names — consumer, kit, self — name it \`index.<name>.ts\` and declare it if it is an entry, or move it into docs/ if it explains
                read: docs/07-quality-checks.md#the-lint-tree
        `);
    });
});
