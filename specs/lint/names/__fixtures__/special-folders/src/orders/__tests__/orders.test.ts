import { expect, test } from 'vitest';

import { orders } from '../orders.js';

test('orders — starts empty', () => {
    expect(orders).toStrictEqual([]);
});
