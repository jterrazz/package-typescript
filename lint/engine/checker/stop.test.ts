import { describe, expect, test } from 'vitest';

import { exitCodeOf, stop } from './stop.js';

describe('stop', () => {
    test('a program that returns ends at 0, one that stops ends at its code', () => {
        // Given - a program that finishes and one that stops at 1
        // Then - each ends with the code it ran to
        expect([exitCodeOf(() => {}), exitCodeOf(() => stop(1))]).toStrictEqual([0, 1]);
    });

    test('a failure that is no stop is thrown on, never read as a code', () => {
        // Given - a program that fails
        // Then - the failure reaches the caller as it was thrown
        expect(() =>
            exitCodeOf(() => {
                throw new TypeError('broken');
            }),
        ).toThrow(TypeError);
    });
});
