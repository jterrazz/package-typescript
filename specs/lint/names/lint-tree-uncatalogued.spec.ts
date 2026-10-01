import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('lint-tree-uncatalogued', () => {
    test('holds a lint/ with no catalogue to its root and folders, never guessing a family', async () => {
        // Given - a lint/ tree with no catalogue, and a file at its root
        const result = await lint.fixture(directory('./_fixtures/lint-tree-uncatalogued/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            lint/README.md:1:1  names(lint-root-holds-only-composers)
                found: \`lint/README.md\` sits at the root of lint/
                why: lint/ has one tree in every repository — its root holds the modules that compose consumer/ with engine/: the entries, the bins and what src/ reads, and a folder names the audience of every other file
                fix: move it into the folder its audience names — consumer, engine, self — or into docs/ if it explains
                read: docs/06-quality-checks.md#the-lint-tree
        `);
    });
});
