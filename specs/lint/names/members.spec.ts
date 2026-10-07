import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('members', () => {
    test('holds every workspace member to a spine of its own, lint/ only where the member ships it', async () => {
        // Given - a workspace whose members keep their own spine, one with a root beside it and one holding a lint/ it never publishes
        const result = await lint.fixture(directory('./__fixtures__/members/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            apps/api/scripts/:1:1  names(no-undeclared-root-folder)
                found: \`apps/api/scripts/\` is a root outside the spine
                why: Every root folder is on the root spine, imposed by a tool, or declared with its reason.
                fix: move it under src/, or declare it in apps/api/jterrazz.config.ts's \`typescript.roots\` with its reason
                read: docs/reference/quality-checks.md#a-root-beside-the-spine
            apps/web/lint/:1:1  names(no-undeclared-root-folder)
                found: \`apps/web/lint/\` holds the lint rules a package ships, and neither apps/web/package.json nor its build publishes it
                why: Every root folder is on the root spine, imposed by a tool, or declared with its reason.
                fix: ship it, or move it under src/
                read: docs/reference/quality-checks.md#a-root-beside-the-spine
        `);
    });
});
