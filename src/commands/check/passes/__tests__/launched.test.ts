import { describe, expect, onTestFinished, test, vi } from 'vitest';

import {
    launched,
    secondsAdded,
    secondsSince,
    slowestOf,
    timed,
    timedLaunch,
    timedLaunches,
} from '../launched.js';

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

    test('timed — the seconds wait for the verdict', async () => {
        // Given - a run whose verdict has not come, the event loop let turn once
        const verdict = Promise.withResolvers<number>();
        const run = timed(verdict.promise, 0);
        await new Promise((resolve) => {
            setImmediate(resolve);
        });

        // Then - its seconds are still pending
        await expect(Promise.race([run.seconds, Promise.resolve('pending')])).resolves.toBe(
            'pending',
        );
        verdict.resolve(0);
    });

    test('secondsAdded and slowestOf — two runs in a row add up to the tenth; runs in parallel last as their slowest, and none as nothing', () => {
        // Given - a run of 1.26 s then one of 0.33 s, and three runs side by side
        const parallel = [{ seconds: 0.4 }, { seconds: 2.5 }, { seconds: 1.1 }];

        // Then - 1.6 s in a row, 2.5 s side by side, 0 s for no run
        expect([secondsAdded(1.26, 0.33), slowestOf(parallel), slowestOf([])]).toStrictEqual([
            1.6, 2.5, 0,
        ]);
    });

    test('timedLaunch and timedLaunches — a pass keeps what it carries and is timed from the moment named, or from now; an absent pass stays absent', async () => {
        // Given - a clock read at 4 000 ms when each verdict is in, a pass launched at 1 000 ms, two runs counted from 2 000 ms, and a pass timed from now at 3 000 ms
        clockAt(3000, 4000, 4000, 4000, 4000);
        const fromNow = timedLaunch({ label: 'one', log: 'a.log', status: Promise.resolve(0) });
        const named = timedLaunch({ log: 'b.log', status: Promise.resolve(1) }, 1000);
        const runs = timedLaunches(
            [
                { log: 'c.log', status: Promise.resolve(0) },
                { log: 'd.log', status: Promise.resolve(2) },
            ],
            2000,
        );

        // Then - each its own seconds, its fields kept, and nothing for a pass that did not apply
        expect([
            fromNow?.label,
            await fromNow?.seconds,
            named?.log,
            await named?.seconds,
            await Promise.all(runs.map(async ({ log, seconds }) => [log, await seconds])),
            timedLaunch(undefined),
        ]).toStrictEqual([
            'one',
            1,
            'b.log',
            3,
            [
                ['c.log', 2],
                ['d.log', 2],
            ],
            undefined,
        ]);
    });
});
