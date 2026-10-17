import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../comments-lint.specification.js';

describe('kinds', () => {
    test('refuses a comment that states no kind and a directive whose reason states one, and none that does or that is a hover', async () => {
        // Given - a tagged comment, a hover doc, two comments that state no kind, and a directive whose reason states one
        const result = await lint.fixture(directory('./__fixtures__/kinds/')).run();

        // Then - each refused comment at its position, with its lesson
        expect(result.report).toMatch(`
            src/ledger.ts:4:1  jterrazz-typescript(comment-states-its-kind)
                found: a comment that states no kind
                why: the default is no comment: the code speaks through its names, and a comment is kept only for what they cannot say: an invariant, a hazard, a constraint from outside the codebase, why a value is this one
                fix: delete it, rename what needed it, or, when it annotates a literal, name the value with a constant; a comment that states what the code cannot opens with its kind (\`invariant:\`, \`hazard:\`, \`outside:\`, \`value:\`), and an exported symbol's editor hover is one \`/** ... */\` paragraph above it, its block tags (\`@param\`, \`@example\`) on the lines after it
                read: docs/reference/lint-presets.md#a-comment-states-its-kind
            src/ledger.ts:11:36  jterrazz-typescript(comment-states-its-kind)
                found: a comment that states no kind
                why: the default is no comment: the code speaks through its names, and a comment is kept only for what they cannot say: an invariant, a hazard, a constraint from outside the codebase, why a value is this one
                fix: delete it, rename what needed it, or, when it annotates a literal, name the value with a constant; a comment that states what the code cannot opens with its kind (\`invariant:\`, \`hazard:\`, \`outside:\`, \`value:\`), and an exported symbol's editor hover is one \`/** ... */\` paragraph above it, its block tags (\`@param\`, \`@example\`) on the lines after it
                read: docs/reference/lint-presets.md#a-comment-states-its-kind
            src/ledger.ts:15:1  jterrazz-typescript(comment-states-its-kind)
                found: a tool instruction whose reason states a kind
                why: the default is no comment: the code speaks through its names, and a comment is kept only for what they cannot say: an invariant, a hazard, a constraint from outside the codebase, why a value is this one
                fix: drop the kind: a tool instruction is its own kind, and its reason follows it bare; \`typescript fix\` drops it
                read: docs/reference/lint-presets.md#a-comment-states-its-kind
        `);
    });
});
