import { clock, waitUntil } from '@jterrazz/test';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { describe, expect, test, vi } from 'vitest';

import { residentOf, residentWatch } from '../ps.js';

describe('ps', () => {
    test('residentOf — the memory of the tools a pid started, and below them at any depth, the pid and its siblings left out', () => {
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

        // Then - 200 and 700 kilobytes of tools with 30, 4 and 60 below them; a gate whose one tool started nothing holds it alone
        expect([residentOf(table, 10), residentOf(table, 12)]).toStrictEqual([
            { below: 94 * 1024, tools: 900 * 1024 },
            { below: 0, tools: 4 * 1024 },
        ]);
    });

    test('residentOf — a process priced apart is left out with every process below it, a tool priced apart whole', () => {
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
            residentOf(table, 10, { apart: new Set([13, 14]) }),
            residentOf(table, 10, { apart: new Set([13, 14, 16]) }),
            residentOf(table, 10),
        ]).toStrictEqual([
            { below: 450 * 1024, tools: 400 * 1024 },
            { below: 400 * 1024, tools: 300 * 1024 },
            { below: 4650 * 1024, tools: 400 * 1024 },
        ]);
    });

    test('residentOf — the tools reach the depth asked, npm and the Vitest it starts, and everything deeper is their workers', () => {
        // Given - a command 10 that started npm 11, which started Vitest 12 with two workers 13 and 14, the second running a browser 15
        const table = [
            ' 11    10     60',
            ' 12    11    600',
            ' 13    12    300',
            ' 14    12    250',
            ' 15    14    400',
        ].join('\n');

        // Then - npm and Vitest held once, their three processes below them
        expect(residentOf(table, 10, { depth: 2 })).toStrictEqual({
            below: 950 * 1024,
            tools: 660 * 1024,
        });
    });

    test('residentWatch — a watch stopped leaves no timer behind', () => {
        // Given - a watch under a pinned scheduler, stopped at once
        using _ = clock.run('2026-10-20T00:00:00Z');
        residentWatch(process.pid, 10).stop();

        // Then - no timer is left to sample
        expect(vi.getTimerCount()).toBe(0);
    });

    test('residentWatch — each sample of what the tools of a pid held and started, a process priced apart left out, none once stopped', async () => {
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
        const watch = residentWatch(process.pid, 10);
        const apart = residentWatch(process.pid, 10, { apart: () => new Set([grandchild]) });
        await waitUntil(
            () => watch.read().some(({ below }) => below > 0) && apart.read().length > 0,
        );
        const whole = watch.stop();
        const held = apart.stop();
        process.kill(grandchild);
        tool.kill();
        const quiet = residentWatch(process.pid, 1000).stop();

        // Then - the grandchild's memory was seen below the child, none of it once priced apart, the child held as a tool each time, and a watch stopped before its first sample saw nothing
        expect(Math.max(...whole.map(({ below }) => below))).toBeGreaterThan(1024 * 1024);
        expect([
            held.map(({ below }) => below).filter((below) => below > 0),
            held.every(({ tools }) => tools > 1024 * 1024),
            quiet,
        ]).toStrictEqual([[], true, []]);
    });
});
