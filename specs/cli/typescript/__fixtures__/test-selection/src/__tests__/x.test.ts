import { expect, test } from 'vitest';

import { x } from '../x.ts';

test('x is x', () => {
    expect(x()).toBe('x');
});
