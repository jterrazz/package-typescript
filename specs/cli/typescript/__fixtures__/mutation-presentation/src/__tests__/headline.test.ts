import { expect, test } from 'vitest';

import { headline } from '../headline.js';

test('a price above a hundred cents is too dear, and one at a hundred a bargain', () => {
    expect([headline(101), headline(100)]).toStrictEqual(['Too dear', 'A bargain']);
});
