import { expect, test } from 'vitest';

import { lengthOf } from '../length.js';

test('a value is as long as its characters', () => {
    expect(lengthOf('abc')).toBe(3);
});
