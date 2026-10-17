import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { launched, secondsSince, timed } from '../launched.js';

function clockAt(...moments: number[]): void {
    const now = vi.spyOn(performance, 'now');
    for (const moment of moments) {
        now.mockReturnValueOnce(moment);
    }
    onTestFinished(() => {
        now.mockRestore();
    });
}

describe('launched', () => {
    test('secondsSince — the time since a moment, to the tenth of a second', () => {
        // Given - a clock read at 10 260 ms, then at 10 240 ms
        clockAt(10_260, 10_240);

        // Then - each distance from 9 000 ms rounds to its nearest tenth
        expect([secondsSince(9000), secondsSince(9000)]).toStrictEqual([1.3, 1.2]);
    });

    test('launched — a pass is timed from its launch to its verdict, its log and status kept', async () => {
        // Given - a pass launched at 1 000 ms whose verdict comes at 3 500 ms
        clockAt(1000, 3500);
        const pass = launched('names.log', Promise.resolve(3));

        // Then - its own two and a half seconds
        expect([pass.log, await pass.status, await pass.seconds]).toStrictEqual([
            'names.log',
            3,
            2.5,
        ]);
    });

    test('timed — a run that rejects is timed all the same, from the moment it is handed', async () => {
        // Given - a run counted from 2 000 ms that rejects, read at 7 000 ms
        clockAt(7000);
        const run = timed(Promise.reject(new Error('stopped')), 2000);

        // Then - five seconds, and the rejection still reaches its reader
        await expect(run.seconds).resolves.toBe(5);
        await expect(run.status).rejects.toThrow('stopped');
    });
});
