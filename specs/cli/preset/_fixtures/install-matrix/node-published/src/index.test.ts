import { expect, test } from 'vitest';

import { greet } from './index.js';

export const { cleanup, name } = await Promise.resolve({
    cleanup: (): null => null,
    name: 'world',
});

test('greets by name', () => {
    // Given - a name
    // Then - the greeting carries it
    expect(greet(name)).toBe('hello world');
    cleanup();
});
