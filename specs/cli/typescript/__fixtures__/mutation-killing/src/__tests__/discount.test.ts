import { expect, test } from 'vitest';

import { discounted } from '../discount.js';

test('a discount takes its rate off the price', () => {
    expect(discounted(200, 0.25)).toBe(150);
});

test('half the price is the deepest discount', () => {
    expect(discounted(100, 0.5)).toBe(50);
});

test('a discount above half the price is refused', () => {
    expect(() => discounted(100, 0.75)).toThrow('a discount above half the price');
});
