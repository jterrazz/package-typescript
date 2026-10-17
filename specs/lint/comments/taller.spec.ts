import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../comments-lint.specification.js';

describe('taller', () => {
    test('refuses a comment taller than a private function, and none a disable directive sets aside', async () => {
        // Given - a doc comment over each private function, two of them disabled
        const result = await lint.fixture(directory('./__fixtures__/taller/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            src/ledger.ts:2:1  jterrazz-typescript(comment-no-longer-than-its-function)
                found: a comment of 4 lines on a function whose body holds 1
                why: the default is no comment: the code speaks through its names, and a comment longer than the code it sits on restates it, argues it or tells its history
                fix: say it through the names: rename what needed the comment, and keep at most the one line the code cannot say (an invariant, a hazard, why a value is this one); if documenting context that lives outside the codebase is truly necessary (a policy, a ticket, a decision maker, an external system's constraint), disable it explicitly on that line with \`// oxlint-disable-next-line jterrazz-typescript/comment-no-longer-than-its-function -- <the external context>\`, the reason required
                read: docs/reference/lint-presets.md#a-comment-no-longer-than-its-function
        `);
    });
});
