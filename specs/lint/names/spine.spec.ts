import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('spine', () => {
    test('fails a skill holding more than its SKILL.md, and a root outside the spine nobody declared', async () => {
        // Given - a skill folder holding a file beside its SKILL.md, and a `scripts/` root no setting declares
        const result = await lint.fixture(directory('./__fixtures__/spine/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            blueprint/:1:1  names(no-undeclared-root-folder)
                found: \`blueprint/\` is a root outside the spine
                why: Every root folder is on the root spine, imposed by a tool, or declared with its reason.
                fix: a product vision belongs in the brand wiki and a repository manual in docs/; move it under src/, or declare it in jterrazz.config.ts's \`typescript.roots\` with its reason
                read: docs/reference/quality-checks.md#a-root-beside-the-spine
            scripts/:1:1  names(no-undeclared-root-folder)
                found: \`scripts/\` is a root outside the spine
                why: Every root folder is on the root spine, imposed by a tool, or declared with its reason.
                fix: move it under src/, or declare it in jterrazz.config.ts's \`typescript.roots\` with its reason
                read: docs/reference/quality-checks.md#a-root-beside-the-spine
        `);
    });
});
