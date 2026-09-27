import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('roots-declared', () => {
    test('accepts an imposed root or one jterrazz.config.ts declares, and refuses every other', async () => {
        // Given - a root a tool imposes, one the settings declare with its reason, and one nobody declares
        const result = await lint.fixture(directory('./_fixtures/roots-declared/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            deploy/:1:1  names(no-undeclared-root-folder)
                found: \`deploy/\` is a root outside the spine
                why: Every root folder is on the spine, imposed by a tool, or declared with its reason.
                fix: move it under src/, or declare it in jterrazz.config.ts's \`typescript.roots\` with its reason
                read: docs/06-quality-checks.md#a-root-beside-the-spine
            docker/:1:1  names(declared-root-states-its-reason)
                found: \`docker/\` is declared in jterrazz.config.ts's \`typescript.roots\` with no reason
                why: A root declared in typescript.roots states why the repository keeps it.
                fix: say why the repository keeps it
                read: docs/06-quality-checks.md#a-root-beside-the-spine
            migrations/:1:1  names(declared-root-holds-files)
                found: \`migrations/\` is declared in jterrazz.config.ts's \`typescript.roots\` and holds no file
                why: A root declared in typescript.roots holds a file git does not ignore.
                fix: delete the entry
                read: docs/06-quality-checks.md#a-root-beside-the-spine
        `);
    });
});
