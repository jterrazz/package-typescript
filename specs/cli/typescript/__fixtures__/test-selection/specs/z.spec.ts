import { expect, test } from 'vitest';

import { z } from '../src/z.ts';

test('z is z', () => {
    expect(z()).toBe('z');
});
