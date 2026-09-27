import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('vague', () => {
    test('fails a tree whose folder names no subject and whose file names one in half', async () => {
        // Given - the tree
        const result = await lint.fixture(directory('./_fixtures/vague/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            specs/orders/_setup/utils:1:1  names(no-grab-bag-name)
                found: \`utils\` names no subject — it holds whatever nobody placed
                why: A directory or file is named for the subject it holds, never a grab-bag word.
                fix: name it for the subject it holds, or move what it holds beside the code that uses it
                read: docs/06-quality-checks.md#the-names-tree-pass
            src/_helpers:1:1  names(no-grab-bag-name)
                found: \`_helpers\` names no subject — it holds whatever nobody placed
                why: A directory or file is named for the subject it holds, never a grab-bag word.
                fix: name it for the subject it holds, or move what it holds beside the code that uses it
                read: docs/06-quality-checks.md#the-names-tree-pass
            src/_tmp:1:1  names(no-abbreviated-word)
                found: \`_tmp\` is a word written in half
                why: Every word of a name is spelled whole.
                fix: spell every word of it whole
                read: docs/06-quality-checks.md#the-names-tree-pass
            src/common.ts:1:1  names(no-grab-bag-name)
                found: \`common\` names no subject — it holds whatever nobody placed
                why: A directory or file is named for the subject it holds, never a grab-bag word.
                fix: name it for the subject it holds, or move what it holds beside the code that uses it
                read: docs/06-quality-checks.md#the-names-tree-pass
            src/gateway/repo-client.ts:1:1  names(no-abbreviated-word)
                found: \`repo-client\` is a word written in half
                why: Every word of a name is spelled whole.
                fix: spell every word of it whole
                read: docs/06-quality-checks.md#the-names-tree-pass
            src/helpers.ts:1:1  names(no-grab-bag-name)
                found: \`helpers\` names no subject — it holds whatever nobody placed
                why: A directory or file is named for the subject it holds, never a grab-bag word.
                fix: name it for the subject it holds, or move what it holds beside the code that uses it
                read: docs/06-quality-checks.md#the-names-tree-pass
            src/misc.ts:1:1  names(no-grab-bag-name)
                found: \`misc\` names no subject — it holds whatever nobody placed
                why: A directory or file is named for the subject it holds, never a grab-bag word.
                fix: name it for the subject it holds, or move what it holds beside the code that uses it
                read: docs/06-quality-checks.md#the-names-tree-pass
            src/utils:1:1  names(no-grab-bag-name)
                found: \`utils\` names no subject — it holds whatever nobody placed
                why: A directory or file is named for the subject it holds, never a grab-bag word.
                fix: name it for the subject it holds, or move what it holds beside the code that uses it
                read: docs/06-quality-checks.md#the-names-tree-pass
        `);
    });
});
