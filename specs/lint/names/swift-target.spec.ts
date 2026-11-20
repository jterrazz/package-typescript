import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('swift-target', () => {
    test('allows ground directly in a test target, and refuses it in a code root or beside the targets', async () => {
        // Given - a golden in tests/<target>/__expected__/, one in src/__expected__/ and one in tests/__expected__/, which has no target level
        const result = await lint.fixture(directory('./__fixtures__/swift-target/')).run();

        // Then - only the two outside a target are refused
        expect(result.report).toMatch(`
            src/__expected__/:1:1  names(directory-in-kebab-case)
                found: \`src/__expected__/\` is the ground of a test outside every \`__tests__/\`
                why: a \`__<word>__/\` folder is one the toolchain gives a meaning to: in a code root the special folders are \`__tests__/\`, and every other folder is named for what it holds
                fix: move it into the \`__tests__/\` of its folder, beside the module tests that read it
                read: docs/reference/quality-checks.md#the-names-tree-pass
            tests/__expected__/:1:1  names(directory-in-kebab-case)
                found: \`tests/__expected__/\` is the ground of a test outside every \`__tests__/\`
                why: a \`__<word>__/\` folder is one the toolchain gives a meaning to: in a code root the special folders are \`__tests__/\`, and every other folder is named for what it holds
                fix: move it into the \`__tests__/\` of its folder, beside the module tests that read it
                read: docs/reference/quality-checks.md#the-names-tree-pass
        `);
    });
});
