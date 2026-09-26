import { expect, test } from 'vitest';

/*
 * The boolean pair, decided the strict way. `toBe(true)` is an assertion about
 * a boolean; `toBeTruthy()` is an assertion about anything at all, so the fixer
 * that rewrote the first into the second weakened every spec it touched.
 */

test('states a boolean strictly', () => {
    // Given - a boolean
    const ready = Boolean(1);

    // Then - the strict matcher survives the fixer untouched
    expect(ready).toBe(true);
});

test('states a boolean loosely', () => {
    // Given - the same boolean
    const ready = Boolean(1);

    // Then - the loose matcher is what the rulebook reports now
    expect(ready).toBeTruthy();
});
