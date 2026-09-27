import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('spine', () => {
    test('fails a skill holding more than its SKILL.md, and a root outside the spine nobody declared', async () => {
        // Given - the tree
        const result = await lint.fixture(directory('./_fixtures/spine/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            scripts/:1:1  names(no-undeclared-root-folder)
                found: \`scripts/\` is a root outside the spine
                why: Every root folder is on the spine, imposed by a tool, or declared with its reason.
                fix: move it under src/, or declare it in jterrazz.config.ts's \`typescript.roots\` with its reason
                read: docs/06-quality-checks.md#a-root-beside-the-spine
            skills/shop/references/:1:1  names(skill-holds-only-skill-md)
                found: \`skills/shop/references/\` sits beside a skill's \`SKILL.md\`
                why: a skill is one \`skills/<skill>/SKILL.md\`, the one page an agent loads, and a file beside it is one no agent reads
                fix: fold what it says into the \`SKILL.md\` or into the chapter the skill routes to, and delete it
                read: docs/06-quality-checks.md#the-names-tree-pass
        `);
    });
});
