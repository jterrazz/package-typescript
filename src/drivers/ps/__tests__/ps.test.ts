import { clock, waitUntil } from '@jterrazz/test';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { describe, expect, test, vi } from 'vitest';

import { residentBelowTools, residentPeak } from '../ps.js';

describe('ps', () => {
    test('residentBelowTools — the memory below each tool a pid started, at any depth, the tools, the pid and its siblings left out', () => {
        // Given - a gate 10 whose two tools 11 and 14 each started processes, one listed before its parent, a sibling of 10, and lines that are no row: one short of a column, one whose memory is no number, both below a tool
        const table = [
            '  1     0   9000',
            ' 13    12      4',
            ' 12    11     30',
            ' 10     1   5000',
            ' 11    10    200',
            ' 14    10    700',
            ' 15    14     60',
            ' 16     1    800',
            ' 17    11',
            ' 18    11    x',
            'garbled',
            '',
        ].join('\n');

        // Then - 30, 4 and 60 kilobytes below 10's tools; nothing below a gate whose tools started nothing
        expect([residentBelowTools(table, 10), residentBelowTools(table, 12)]).toStrictEqual([
            94 * 1024,
            0,
        ]);
    });

    test('residentBelowTools — a process priced apart is left out with every process below it, a tool priced apart whole', () => {
        // Given - a gate 10 whose tool 11 started a runner 12 and a checker 13, the runner a nested gate 14 with its own runner 15, and a second tool 16 with a process 17
        const table = [
            ' 11    10    300',
            ' 12    11    400',
            ' 13    11    700',
            ' 14    12   2000',
            ' 15    14   1500',
            ' 16    10    100',
            ' 17    16     50',
        ].join('\n');

        // Then - the checker and the nested gate held apart leave the runner and the second tool's process; the second tool apart leaves the runner alone
        expect([
            residentBelowTools(table, 10, new Set([13, 14])),
            residentBelowTools(table, 10, new Set([13, 14, 16])),
            residentBelowTools(table, 10),
        ]).toStrictEqual([450 * 1024, 400 * 1024, 4650 * 1024]);
    });

    test('residentPeak — a watch stopped leaves no timer behind', () => {
        // Given - a watch under a pinned scheduler, stopped at once
        using _ = clock.run('2026-10-20T00:00:00Z');
        residentPeak(process.pid, 10).stop();

        // Then - no timer is left to sample
        expect(vi.getTimerCount()).toBe(0);
    });

    test('residentPeak — the most memory what the tools of a pid started held while watched, a process priced apart left out, nothing once stopped', async () => {
        // Given - a child of this process that starts a grandchild living until the watch has sampled it, watched once whole and once with the grandchild priced apart, and a watch stopped before its first sample
        const tool = spawn(process.execPath, [
            '--eval',
            "const { spawn } = require('node:child_process'); const held = spawn(process.execPath, ['--eval', 'setTimeout(() => {}, 20000)'], { stdio: 'inherit' }); console.log(held.pid); setTimeout(() => {}, 20000);",
        ]);
        const grandchild = await new Promise<number>((resolve) => {
            tool.stdout.once('data', (data: Buffer) => {
                resolve(Number(String(data).trim()));
            });
        });
        const watch = residentPeak(process.pid, 10);
        const apart = residentPeak(process.pid, 10, () => new Set([grandchild]));
        await waitUntil(() => (watch.read() ?? 0) > 0 && apart.read() !== undefined);
        const peaks = [watch.stop(), apart.stop()];
        process.kill(grandchild);
        tool.kill();
        const quiet = residentPeak(process.pid, 1000).stop();

        // Then - the grandchild's memory was seen, none of it once priced apart, and a watch stopped before its first sample saw nothing
        expect(peaks[0]).toBeGreaterThan(1024 * 1024);
        expect([peaks[1], quiet]).toStrictEqual([0, undefined]);
    });
});
