import { expect, test } from 'vitest';

import { doubled } from './doubled.js';

test('doubling keeps a number positive', () => {
    expect(doubled(3)).toBeGreaterThan(0);
});
