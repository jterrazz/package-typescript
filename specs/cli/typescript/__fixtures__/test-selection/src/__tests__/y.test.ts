import { expect, test } from 'vitest';

import { y } from '../y.ts';

test('y is y', () => {
    expect(y()).toBe('y');
});
