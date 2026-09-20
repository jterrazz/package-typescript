import { expect, test } from 'vitest';

/*
 * The filename floor admits both spellings. `vitest/consistent-test-filename`
 * ships a pattern naming `<name>.test.ts` alone, and @jterrazz/test 16 renamed
 * every file under `specs/` to `.spec.ts` — so a repository composing this
 * profile without that package was told to undo the rename. This file is here
 * to be reported by NOTHING.
 */

test('states a claim under the other suffix', () => {
    // Given - a value the rulebook has no opinion about
    const answer = 1;

    // Then - the suffix is the subject here, not the assertion
    expect(answer).toBe(1);
});
