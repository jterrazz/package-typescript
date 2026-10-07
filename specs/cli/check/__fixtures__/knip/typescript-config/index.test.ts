import { expect, test } from 'vitest';

import { hello } from './index.js';

test('greets the world', () => {
    expect(hello).toBe('world');
});
