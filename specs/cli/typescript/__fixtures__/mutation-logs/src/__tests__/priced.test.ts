import { expect, test } from 'vitest';

import { priced } from '../priced.js';

test('a price above a hundred cents is dear, and one at a hundred or below cheap', () => {
    expect([priced(150), priced(100), priced(50)]).toStrictEqual(['dear', 'cheap', 'cheap']);
});
