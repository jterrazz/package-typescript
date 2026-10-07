import { expect, test } from 'vitest';

import { discounted } from '../discount.js';

test('a discount takes its rate off the price', () => {
    expect(discounted(200, 0.25)).toBe(150);
});
