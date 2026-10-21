import { expect, test } from 'vitest';

import { greet } from '../index';

test('greets by name', () => {
    expect(greet('world')).toBe('hello world');
});
