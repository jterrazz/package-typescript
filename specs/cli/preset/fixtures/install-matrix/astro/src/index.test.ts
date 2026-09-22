import { expect, test } from 'vitest';

import { greet } from './index';

test('greets by name', () => {
    // Given - a name
    // Then - the greeting carries it
    expect(greet('world')).toBe('hello world');
});
