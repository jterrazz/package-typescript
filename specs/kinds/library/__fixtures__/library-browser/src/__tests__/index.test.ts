import { describe, expect, test } from 'vitest';

import { mount } from '../index';

describe('mount', () => {
    test('writes the greeting into the element it is given', () => {
        // Given - an element standing in for the page's root
        const root = { textContent: '' };

        // When - the greeting is mounted on it
        mount(root, 'Ada');

        // Then - the greeting is its text
        expect(root.textContent).toBe('Hello, Ada.');
    });
});
