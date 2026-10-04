import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('directory-case', () => {
    test('fails a directory not written in kebab-case, and keeps a route segment its framework names', async () => {
        // Given - directories not written in kebab-case, beside a route segment its framework names
        const result = await lint.fixture(directory('./_fixtures/directory-case/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            lib/MyThing/:1:1  names(directory-in-kebab-case)
                found: \`lib/MyThing/\` is not written in kebab-case
                why: a directory name is part of every path and import that crosses it, and one case for every name reads the same on a disk that folds case and on one that does not
                fix: rename it in lowercase words joined by \`-\` — a leading \`_\` marks a folder the toolchain owns, and a route segment keeps its framework grammar (\`[id]\`, \`(group)\`, \`@slot\`)
                read: docs/reference/quality-checks.md#the-names-tree-pass
            specs/cli/Smoke_Suite/:1:1  names(directory-in-kebab-case)
                found: \`specs/cli/Smoke_Suite/\` is not written in kebab-case
                why: a directory name is part of every path and import that crosses it, and one case for every name reads the same on a disk that folds case and on one that does not
                fix: rename it in lowercase words joined by \`-\` — a leading \`_\` marks a folder the toolchain owns, and a route segment keeps its framework grammar (\`[id]\`, \`(group)\`, \`@slot\`)
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/UserProfile/:1:1  names(directory-in-kebab-case)
                found: \`src/UserProfile/\` is not written in kebab-case
                why: a directory name is part of every path and import that crosses it, and one case for every name reads the same on a disk that folds case and on one that does not
                fix: rename it in lowercase words joined by \`-\` — a leading \`_\` marks a folder the toolchain owns, and a route segment keeps its framework grammar (\`[id]\`, \`(group)\`, \`@slot\`)
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/orderLines/:1:1  names(directory-in-kebab-case)
                found: \`src/orderLines/\` is not written in kebab-case
                why: a directory name is part of every path and import that crosses it, and one case for every name reads the same on a disk that folds case and on one that does not
                fix: rename it in lowercase words joined by \`-\` — a leading \`_\` marks a folder the toolchain owns, and a route segment keeps its framework grammar (\`[id]\`, \`(group)\`, \`@slot\`)
                read: docs/reference/quality-checks.md#the-names-tree-pass
        `);
    });
});
