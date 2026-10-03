import { expect, test } from 'vitest';

import { greet } from './index.js';

test('greets by name', () => {
    expect(greet('world')).toBe('hello world');
});
