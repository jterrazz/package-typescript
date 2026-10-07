import { expect, test } from 'vitest';

import { discounted } from '../src/discount.js';

test('half the price is the deepest discount', () => {
    expect(discounted(100, 0.5)).toBe(50);
});

test('a discount above half the price is refused', () => {
    expect(() => discounted(100, 0.75)).toThrow('a discount above half the price');
});
