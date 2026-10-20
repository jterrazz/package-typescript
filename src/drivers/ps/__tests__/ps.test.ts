import { clock, waitUntil } from '@jterrazz/test';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { describe, expect, test, vi } from 'vitest';

import { residentBelow, residentPeak } from '../ps.js';

describe('ps', () => {
    test('residentBelow — the resident memory of every process below a pid, at any depth, the pid itself and its siblings left out', () => {
        // Given - a table where 10 has two children, one of which has a child listed before it, a sibling of 10, and lines that are no row: one short of a column, one whose memory is no number
        const table = [
            '  1     0   9000',
            ' 12    11     30',
            ' 10     1   5000',
            ' 11    10    200',
            ' 13    10      4',
            ' 14     1    700',
            ' 15    10',
            ' 16    10    x',
            'garbled',
            '',
        ].join('\n');

        // Then - 200, 30 and 4 kilobytes below 10, nothing below a leaf, everything but itself below 1
        expect([
            residentBelow(table, 10),
            residentBelow(table, 13),
            residentBelow(table, 1),
        ]).toStrictEqual([234 * 1024, 0, 5934 * 1024]);
    });

    test('residentPeak — a watch stopped leaves no timer behind', () => {
        // Given - a watch under a pinned scheduler, stopped at once
        using _ = clock.run('2026-10-20T00:00:00Z');
        residentPeak(process.pid, 10).stop();

        // Then - no timer is left to sample
        expect(vi.getTimerCount()).toBe(0);
    });

    test('residentPeak — the most memory the processes below a pid held while watched, nothing once stopped', async () => {
        // Given - a child of this process that lives until the watch has sampled it, and a watch stopped before its first sample
        const child = spawn(process.execPath, ['--eval', 'setTimeout(() => {}, 20000)']);
        const watch = residentPeak(process.pid, 10);
        await waitUntil(() => (watch.read() ?? 0) > 0);
        const peak = watch.stop();
        child.kill();
        const quiet = residentPeak(process.pid, 1000).stop();

        // Then - the child's memory was seen, and a watch stopped before its first sample saw nothing
        expect(peak).toBeGreaterThan(1024 * 1024);
        expect(quiet).toBeUndefined();
    });
});
