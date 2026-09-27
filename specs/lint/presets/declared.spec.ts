import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../presets-declared-lint.specification.js';

describe('declared', () => {
    test('holds the project to the layers and the name rules its presets and its own settings declare', async () => {
        // Given - the tree
        const result = await lint.fixture(directory('./_fixtures/declared/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            specs/notes.ts:1:1  names(specs-root-holds-facets)
                found: \`specs/notes.ts\` breaks ls-lint's \`.*: exists:0\`
                why: the specs root holds its facets and their runners alone
                fix: move it into the facet that reads it
                read: docs/testing.md#the-specs-root
            src/orderLine.ts:1:1  names(module-in-kebab-case)
                found: \`src/orderLine.ts\` breaks ls-lint's \`.ts: kebabcase\`
                why: one case for every module keeps a search to one spelling
                fix: rename it in kebab-case
                read: docs/naming.md#modules
            src/widget.test.ts:1:23  architecture(no-test-to-test-import)
                found: \`src/widget.test.ts\` imports \`src/other.test.ts\`
                why: a test importing a test couples two files that each prove one thing
                fix: move what both tests read into a module neither of them is
                read: docs/testing.md#sharing
        `);
    });
});
