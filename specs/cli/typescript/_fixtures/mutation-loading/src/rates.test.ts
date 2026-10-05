import { expect, test } from 'vitest';

import { HALF } from './rates.js';

test('the first rate, as the table names it', () => {
    expect(HALF).toBe('HALF');
});
