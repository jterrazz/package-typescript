import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../comments-lint.specification.js';

describe('kinds', () => {
    test('refuses a comment that states no kind, and none that does or that is a hover', async () => {
        // Given - a tagged comment, a hover doc, and two comments that state no kind
        const result = await lint.fixture(directory('./_fixtures/kinds/')).run();

        // Then - each untagged comment at its position, with its lesson
        expect(result.report).toMatch(`
            src/ledger.ts:4:1  jterrazz-typescript(comment-states-its-kind)
                found: a comment that states no kind
                why: the default is no comment — the code speaks through its names, and a comment is kept only for what they cannot say: an invariant, a hazard, a constraint from outside the codebase, why a value is this one
                fix: delete it, or rename what needed it; a comment that states what the code cannot opens with its kind — \`invariant:\`, \`hazard:\`, \`outside:\`, \`value:\` — and a symbol's editor hover is one \`/** … */\` line
                read: docs/reference/lint-presets.md#a-comment-states-its-kind
            src/ledger.ts:11:36  jterrazz-typescript(comment-states-its-kind)
                found: a comment that states no kind
                why: the default is no comment — the code speaks through its names, and a comment is kept only for what they cannot say: an invariant, a hazard, a constraint from outside the codebase, why a value is this one
                fix: delete it, or rename what needed it; a comment that states what the code cannot opens with its kind — \`invariant:\`, \`hazard:\`, \`outside:\`, \`value:\` — and a symbol's editor hover is one \`/** … */\` line
                read: docs/reference/lint-presets.md#a-comment-states-its-kind
        `);
    });
});
