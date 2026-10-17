import { describe, expect, test } from 'vitest';

import { launched } from '../launched.js';
import type { Launched } from '../launched.js';
import { writersDone, writersOf } from '../started.js';

const pending = (): { release: () => void; writer: Launched } => {
    const settled = Promise.withResolvers<number>();

    return {
        release: () => {
            settled.resolve(0);
        },
        writer: launched('slow', settled.promise),
    };
};

describe('started', () => {
    test('writersOf — the writing passes of a fix, in the order the formatter waits for them, and the absent ones kept as absent', () => {
        // Given - eight passes, two of them not selected
        const one = launched('architecture', Promise.resolve(0));
        const two = launched('comments', Promise.resolve(0));
        const three = launched('names', Promise.resolve(0));

        // Then - the eight places, in the alphabet of the launch
        expect(
            writersOf({
                architecture: one,
                astro: undefined,
                comments: two,
                config: undefined,
                gitignore: undefined,
                markdown: undefined,
                names: three,
                suppressions: undefined,
            }),
        ).toStrictEqual([one, undefined, two, undefined, undefined, undefined, three, undefined]);
    });

    test('writersDone — ends once every writer has ended, a failed one and an absent one included, and not before', async () => {
        // Given - a writer that ends later, a writer that fails, and an absent one
        const slow = pending();
        const failing = launched('failing', Promise.reject(new Error('boom')));
        const ended: string[] = [];

        // When - the formatter's wait begins, and the slow writer is still running
        const afterWriters = async (): Promise<void> => {
            await writersDone([slow.writer, failing, undefined]);
            ended.push('done');
        };
        const waiting = afterWriters();
        await Promise.resolve();
        await Promise.resolve();
        const whileRunning = [...ended];
        slow.release();
        await waiting;

        // Then - it did not end while the slow writer ran, and it ended when the writer did
        expect([whileRunning, ended]).toStrictEqual([[], ['done']]);
    });
});
