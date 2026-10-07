import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('config-invalid', () => {
    test('refuses a jterrazz.config.ts it cannot read, and holds no root it would have declared', async () => {
        // Given - a jterrazz.config.ts whose `roots` is not an object, beside the root it would have declared
        const result = await lint.fixture(directory('./__fixtures__/config-invalid/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            jterrazz.config.ts:1:1  names(jterrazz-config-loads)
                found: \`jterrazz.config.ts\` holds a \`typescript.roots\` that is not an object mapping each folder to its reason
                why: The settings file jterrazz.config.ts loads, and its typescript section has the declared shape.
                fix: correct jterrazz.config.ts until it loads and each preset and section has its declared shape, then run again
                read: docs/reference/configuration.md#the-merge-order
            scripts/:1:1  names(no-undeclared-root-folder)
                found: \`scripts/\` is a root outside the spine
                why: Every root folder is on the root spine, imposed by a tool, or declared with its reason.
                fix: move it under src/, or declare it in jterrazz.config.ts's \`typescript.roots\` with its reason
                read: docs/reference/quality-checks.md#a-root-beside-the-spine
        `);
    });
});
