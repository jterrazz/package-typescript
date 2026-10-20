import { expect, test } from 'vitest';

import { rated } from '../rates.js';

test('a price is above each threshold from one to sixteen cents, and not at it', () => {
    expect(Array.from({ length: 18 }, (_, cents) => rated(cents))).toStrictEqual(
        Array.from({ length: 18 }, (_, cents) => Array.from({ length: 16 }, (_, at) => cents > at + 1)),
    );
});
