import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('construct', () => {
    test('fails a tree whose files and folders are named after a construct of the language', async () => {
        // Given - files and folders named `types`, `helper`, `constants` and the like
        const result = await lint.fixture(directory('./_fixtures/construct/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            lint/consumer/checks/constants.ts:1:1  names(no-language-construct-name)
                found: \`constants.ts\` names a construct of the language
                why: A directory or file is named for its subject, never for a construct of the language.
                fix: name it for the subject it holds
                read: docs/reference/quality-checks.md#the-names-tree-pass
            specs/orders/constants.ts:1:1  names(no-language-construct-name)
                found: \`constants.ts\` names a construct of the language
                why: A directory or file is named for its subject, never for a construct of the language.
                fix: name it for the subject it holds
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/helper.ts:1:1  names(no-language-construct-name)
                found: \`helper.ts\` names a construct of the language
                why: A directory or file is named for its subject, never for a construct of the language.
                fix: name it for the subject it holds
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/interfaces:1:1  names(no-language-construct-name)
                found: \`interfaces\` names a construct of the language
                why: A directory or file is named for its subject, never for a construct of the language.
                fix: name it for the subject it holds
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/order.types.ts:1:1  names(no-language-construct-name)
                found: \`order.types.ts\` names a construct of the language
                why: A directory or file is named for its subject, never for a construct of the language.
                fix: name it for the subject it holds
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/type.ts:1:1  names(no-language-construct-name)
                found: \`type.ts\` names a construct of the language
                why: A directory or file is named for its subject, never for a construct of the language.
                fix: name it for the subject it holds
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/types.ts:1:1  names(no-language-construct-name)
                found: \`types.ts\` names a construct of the language
                why: A directory or file is named for its subject, never for a construct of the language.
                fix: name it for the subject it holds
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/util.ts:1:1  names(no-language-construct-name)
                found: \`util.ts\` names a construct of the language
                why: A directory or file is named for its subject, never for a construct of the language.
                fix: name it for the subject it holds
                read: docs/reference/quality-checks.md#the-names-tree-pass
        `);
    });
});
