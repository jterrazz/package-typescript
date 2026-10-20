import { expect, test } from 'vitest';

import { CURRENCY, stored, SYMBOL } from '../price-store.js';

test('a price is stored in cents, in euros', () => {
    expect([stored(250), CURRENCY, SYMBOL]).toStrictEqual(['250 cents', 'EUR', '€']);
});

test('a price below zero is refused', () => {
    expect(() => stored(-1)).toThrow('a price below zero');
});
