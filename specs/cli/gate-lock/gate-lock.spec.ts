import { directory } from '@jterrazz/test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

// invariant: the ground cannot be a fixture: the lock names a process, and only a process of this run is known to be alive, or dead, while the command runs.
function lockedBy(pid: number): (workdir: string) => void {
    return (workdir) => {
        mkdirSync(join(workdir, '.artifacts'), { recursive: true });
        writeFileSync(join(workdir, '.artifacts/gate.lock'), `${String(pid)}\n`);
    };
}

describe('gate-lock', () => {
    test('refuses while another live gate holds the checkout, naming its pid', async () => {
        // Given - a checkout locked by this test's own process, which the command is no step of
        const result = await cli
            .fixture(directory('../__fixtures__/sample-app/'))
            .prepare(lockedBy(process.pid))
            .exec('gate-lock');

        // Then - the four parts name the holder, and the lock stays
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            found: the gate of pid {{int}} holds this checkout (.artifacts/gate.lock) · why: an install or a pack replaces what a running gate reads (its build, its install), and the gate would judge a tree that changed under it · fix: wait for pid {{int}} to end, or run an install or a pack in a worktree of its own · read: docs/reference/quality-checks.md#one-gate-per-checkout
        `);
        expect(result.file('.artifacts/gate.lock').content).toBe(`${String(process.pid)}\n`);
    });

    test('passes a checkout no live gate holds, a lock its dead holder left included', async () => {
        // Given - a checkout with no lock, and one locked by a process that has exited
        const dead = spawnSync(process.execPath, ['--eval', '']).pid;
        const free = await cli.fixture(directory('../__fixtures__/sample-app/')).exec('gate-lock');
        const stale = await cli
            .fixture(directory('../__fixtures__/sample-app/'))
            .prepare(lockedBy(dead))
            .exec('gate-lock');

        // Then - both pass, saying no gate holds them
        expect([free.exitCode, stale.exitCode]).toStrictEqual([0, 0]);
        expect(free.stdout.text).toBe(
            ' TYPESCRIPT  No gate holds this checkout (.artifacts/gate.lock)\n',
        );
        expect(stale.stdout.text).toBe(free.stdout.text);
    });

    test('passes a checkout its own gate holds, the one its caller names', async () => {
        // Given - a checkout this test's own process holds, named as the gate the command is a step of
        const result = await cli
            .fixture(directory('../__fixtures__/sample-app/'))
            .prepare(lockedBy(process.pid))
            .env({ TYPESCRIPT_GATE: `${String(process.pid)}:$WORKDIR` })
            .exec('gate-lock');

        // Then - it passes, naming its own gate
        expect([result.exitCode, result.stdout.text]).toStrictEqual([
            0,
            ` TYPESCRIPT  This checkout is held by pid ${String(process.pid)}, the gate this process is a step of\n`,
        ]);
    });
});
