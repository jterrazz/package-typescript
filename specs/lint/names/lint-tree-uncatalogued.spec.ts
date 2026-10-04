import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('lint-tree-uncatalogued', () => {
    test('holds a lint/ with no catalogue to its root and folders, never guessing a family', async () => {
        // Given - a lint/ tree with no catalogue, and a file at its root
        const result = await lint.fixture(directory('./_fixtures/lint-tree-uncatalogued/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            lint/README.md:1:1  names(lint-root-holds-only-entries)
                found: \`lint/README.md\` sits at the root of lint/, and is no entry
                why: lint/ has one tree in every repository — its root holds the entries alone, each \`index[.<name>].ts\` built as a subpath the package publishes or a private import, where consumer/ meets kit/, and a folder names the audience of every other file
                fix: move it into the folder its audience names — consumer, kit, self — name it \`index.<name>.ts\` and declare it if it is an entry, or move it into docs/ if it explains
                read: docs/reference/quality-checks.md#the-lint-tree
        `);
    });
});
