import { expect, test } from 'vitest';

test('states a claim under the other suffix', () => {
    // Given - a value the rulebook has no opinion about
    const answer = 1;

    // Then - the suffix is the subject here, not the assertion
    expect(answer).toBe(1);
});
