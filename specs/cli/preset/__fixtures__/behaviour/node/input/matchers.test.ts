import { expect, test } from 'vitest';

/*
 * outside: the boolean pair, decided the strict way. `toBe(true)` is an assertion about
 * a boolean; `toBeTruthy()` is an assertion about anything at all, so the fixer
 * that rewrote the first into the second weakened every spec it touched.
 */

test('states a boolean strictly', () => {
    const ready = Boolean(1);

    expect(ready).toBe(true);
});

test('states a boolean loosely', () => {
    const ready = Boolean(1);

    expect(ready).toBeTruthy();
});
