import { describe, expect, test } from 'vitest';

import { greeting } from '../index';

describe('greeting', () => {
    test('greets by name', () => {
        // Given - a name
        const name = 'Ada';

        // Then - the greeting carries it
        expect(greeting(name)).toBe('Hello, Ada.');
    });
});
