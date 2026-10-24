import { clock } from '@jterrazz/test';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { CAPACITY_VARIABLE } from '../../../../lint/kit/project/capacity.js';
import { costOf, COSTS_FILE } from '../../../../lint/kit/project/prices.js';
import { leasedTest, testLease } from '../test-lease.js';

function project(): string {
    const fresh = mkdtempSync(join(tmpdir(), 'test-lease-'));
    const root = realpathSync(fresh);
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });

    return root;
}

const given = (capacity: string): NodeJS.ProcessEnv => ({ [CAPACITY_VARIABLE]: capacity });

describe('test-lease', () => {
    test('testLease — a vitest script is handed the workers its slice holds, Vitest held once; any other script, or one stating its own count, none', () => {
        // Given - a project with no cost learned, its script one vitest command given 3 cpus and 64 GB, then 16 cpus and 4 GB, a script that chains, and one that states its workers
        const root = project();

        // Then - the cpus bind at three; 3.5 GB holds Vitest's 300 MB and five 600 MB workers; the other two are left to their own count
        expect([
            testLease(root, 'vitest --run', given('cpus=3,memory=64g')),
            testLease(root, 'vitest --run', given('cpus=16,memory=4g')),
            testLease(root, 'vitest --run && echo done', given('cpus=3,memory=64g')),
            testLease(root, 'vitest --run --maxWorkers=2', given('cpus=3,memory=64g')),
        ]).toStrictEqual([
            {
                line: 'capacity: 3 cpus, 64.0 GB, given by TYPESCRIPT_CAPACITY: this gate 3 cpus, 56.0 GB · Vitest at 300 MB, 3 worker(s) at 600 MB: cpus bind',
                workers: 3,
            },
            {
                line: 'capacity: 16 cpus, 4.0 GB, given by TYPESCRIPT_CAPACITY: this gate 16 cpus, 3.5 GB · Vitest at 300 MB, 5 worker(s) at 600 MB: memory binds',
                workers: 5,
            },
            undefined,
            undefined,
        ]);
    });

    test('leasedTest — the script is handed its workers before the files, and a run of every test file alone teaches the cost, a failed one too, leaving no watch behind', async () => {
        // Given - under a pinned scheduler, runs with no lease, a run of one file and a failed run of every file, each sampled once
        using _ = clock.run('2026-10-24T00:00:00Z');
        const lease = { line: '', workers: 3 };
        const few = project();
        const every = project();
        const handed: (readonly string[])[] = [];
        const run = async (args: readonly string[]): Promise<number> => {
            handed.push(args);
            await vi.advanceTimersByTimeAsync(2000);

            return 1;
        };
        const statuses = [
            await leasedTest(project(), { files: [], lease: undefined }, run),
            await leasedTest(project(), { files: ['a.test.ts'], lease: undefined }, run),
            await leasedTest(few, { files: ['a.test.ts'], lease }, run),
            await leasedTest(every, { files: [], lease }, run),
        ];
        const written: unknown = JSON.parse(readFileSync(join(every, COSTS_FILE), 'utf8'));

        // Then - the files alone without a lease, the count first with one; only the run of every file wrote a cost, every status kept, and no timer left
        expect([
            handed,
            statuses,
            existsSync(join(few, COSTS_FILE)),
            vi.getTimerCount(),
        ]).toStrictEqual([
            [[], ['a.test.ts'], ['--maxWorkers=3', 'a.test.ts'], ['--maxWorkers=3']],
            [1, 1, 1, 1],
            false,
            0,
        ]);
        expect(written).toHaveProperty('vitest tool');
    });

    test('leasedTest — npm and the Vitest it starts are the tool, held once, and only what runs below them is shared by the workers', async () => {
        // Given - a process standing for npm that starts one for Vitest holding 150 MB, which starts one small worker, sampled once under a pinned scheduler
        const vitest = `const held = Buffer.alloc(150 * 1024 * 1024, 1); const worker = require('node:child_process').spawn(process.execPath, ['--eval', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' }); console.log(process.pid, worker.pid); setTimeout(() => held.length, 30000);`;
        const npm = spawn(process.execPath, [
            '--eval',
            `require('node:child_process').spawn(process.execPath, ['--eval', ${JSON.stringify(vitest)}], { stdio: 'inherit' }); setTimeout(() => {}, 30000);`,
        ]);
        const below = await new Promise<number[]>((resolve) => {
            npm.stdout.once('data', (data: Buffer) => {
                resolve(String(data).trim().split(' ').map(Number));
            });
        });
        onTestFinished(() => {
            for (const pid of below) {
                process.kill(pid);
            }
            npm.kill();
        });
        using _ = clock.run('2026-10-24T00:00:00Z');
        const root = project();
        await leasedTest(root, { files: [], lease: { line: '', workers: 1 } }, async () => {
            await vi.advanceTimersByTimeAsync(2000);

            return 0;
        });
        const { tool, worker } = costOf(root, 'vitest');

        // Then - the tool holds Vitest's 150 MB, and the worker is priced by itself alone
        expect(tool).toBeGreaterThan(150 * 1024 * 1024);
        expect(worker).toBeLessThan(100 * 1024 * 1024);
    });
});
