import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('vague', () => {
    test('fails a tree whose folder names no subject, a `_shared/` among them, and whose file names one in half', async () => {
        // Given - grab-bag folders, a `_shared/` in a code root — one under specs/ is the test package's to judge — and names with a word written in half
        const result = await lint.fixture(directory('./__fixtures__/vague/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            specs/cli/auth/cfg.spec.ts:1:1  names(no-abbreviated-word)
                found: \`cfg\` is a word written in half
                why: Every word of a name is spelled whole.
                fix: spell every word of it whole
                read: docs/reference/quality-checks.md#the-names-tree-pass
            specs/orders/__setup__/utils:1:1  names(no-grab-bag-name)
                found: \`utils\` names no subject — it holds whatever nobody placed
                why: A directory or file is named for the subject it holds, never a grab-bag word.
                fix: name it for the subject it holds, or move what it holds beside the code that uses it
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/_helpers:1:1  names(no-grab-bag-name)
                found: \`_helpers\` names no subject — it holds whatever nobody placed
                why: A directory or file is named for the subject it holds, never a grab-bag word.
                fix: name it for the subject it holds, or move what it holds beside the code that uses it
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/_tmp:1:1  names(no-abbreviated-word)
                found: \`_tmp\` is a word written in half
                why: Every word of a name is spelled whole.
                fix: spell every word of it whole
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/agents/_shared:1:1  names(no-grab-bag-name)
                found: \`_shared\` names no subject — its \`_\` already says the row shares it, and the word says it again
                why: A directory or file is named for the subject it holds, never a grab-bag word.
                fix: name it for what its files share (\`_taxonomy/\`, never \`_shared/\`), or move a lone file beside the code that uses it
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/common.ts:1:1  names(no-grab-bag-name)
                found: \`common\` names no subject — it holds whatever nobody placed
                why: A directory or file is named for the subject it holds, never a grab-bag word.
                fix: name it for the subject it holds, or move what it holds beside the code that uses it
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/gateway/repo-client.ts:1:1  names(no-abbreviated-word)
                found: \`repo-client\` is a word written in half
                why: Every word of a name is spelled whole.
                fix: spell every word of it whole
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/helpers.ts:1:1  names(no-grab-bag-name)
                found: \`helpers\` names no subject — it holds whatever nobody placed
                why: A directory or file is named for the subject it holds, never a grab-bag word.
                fix: name it for the subject it holds, or move what it holds beside the code that uses it
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/misc.ts:1:1  names(no-grab-bag-name)
                found: \`misc\` names no subject — it holds whatever nobody placed
                why: A directory or file is named for the subject it holds, never a grab-bag word.
                fix: name it for the subject it holds, or move what it holds beside the code that uses it
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/utils:1:1  names(no-grab-bag-name)
                found: \`utils\` names no subject — it holds whatever nobody placed
                why: A directory or file is named for the subject it holds, never a grab-bag word.
                fix: name it for the subject it holds, or move what it holds beside the code that uses it
                read: docs/reference/quality-checks.md#the-names-tree-pass
        `);
    });
});
