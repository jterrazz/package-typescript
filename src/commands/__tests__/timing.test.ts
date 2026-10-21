import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { secondsSince } from '../timing.js';

describe('timing', () => {
    test('secondsSince — the time since a moment, to the tenth of a second', () => {
        // Given - a clock read at 10 260 ms, then at 10 240 ms
        const now = vi
            .spyOn(performance, 'now')
            .mockReturnValueOnce(10_260)
            .mockReturnValueOnce(10_240);
        onTestFinished(() => {
            now.mockRestore();
        });

        // Then - each distance from 9 000 ms rounds to its nearest tenth
        expect([secondsSince(9000), secondsSince(9000)]).toStrictEqual([1.3, 1.2]);
    });
});
