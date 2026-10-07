import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('special-folders', () => {
    test('refuses a folder spelt like a special one that its root does not list, and ground outside a tests folder', async () => {
        // Given - an unknown special folder in a code root and under specs/, ground at a code root, beside the setup of specs/ and the ground of a module test, whose own folders are never judged
        const result = await lint.fixture(directory('./__fixtures__/special-folders/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            specs/__helpers__/:1:1  names(directory-in-kebab-case)
                found: \`specs/__helpers__/\` is spelt like a special folder, and \`__helpers__/\` is none
                why: a \`__<word>__/\` folder is one the toolchain gives a meaning to — under specs/ the special folders are \`__setup__/\`, \`__expected__/\`, \`__fixtures__/\`, \`__requests__/\`, \`__seeds__/\`, and every other folder is named for what it holds
                fix: move what it holds into one of \`__setup__/\`, \`__expected__/\`, \`__fixtures__/\`, \`__requests__/\`, \`__seeds__/\`, or rename it in kebab-case for what it holds
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/__fixtures__/:1:1  names(directory-in-kebab-case)
                found: \`src/__fixtures__/\` is the ground of a test outside every \`__tests__/\`
                why: a \`__<word>__/\` folder is one the toolchain gives a meaning to — in a code root the special folders are \`__tests__/\`, and every other folder is named for what it holds
                fix: move it into the \`__tests__/\` of its folder, beside the module tests that read it
                read: docs/reference/quality-checks.md#the-names-tree-pass
            src/__mocks__/:1:1  names(directory-in-kebab-case)
                found: \`src/__mocks__/\` is spelt like a special folder, and \`__mocks__/\` is none
                why: a \`__<word>__/\` folder is one the toolchain gives a meaning to — in a code root the special folders are \`__tests__/\`, and every other folder is named for what it holds
                fix: move what it holds into one of \`__tests__/\`, or rename it in kebab-case for what it holds
                read: docs/reference/quality-checks.md#the-names-tree-pass
        `);
    });
});
