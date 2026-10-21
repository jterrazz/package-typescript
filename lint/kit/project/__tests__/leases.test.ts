import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import {
    byAge,
    GATE_VARIABLE,
    gateOf,
    isAlive,
    leaseFolder,
    leaseTaken,
    liveLeases,
} from '../leases.js';
import type { Lease } from '../leases.js';

function folder(): string {
    const fresh = mkdtempSync(join(tmpdir(), 'capacity-'));
    const made = realpathSync(fresh);
    onTestFinished(() => {
        rmSync(made, { force: true, recursive: true });
    });

    return made;
}

function machineFolder(): string {
    const machine = folder();
    vi.stubEnv('TMPDIR', machine);
    onTestFinished(() => {
        vi.unstubAllEnvs();
    });

    return machine;
}

const deadPid = (): number => spawnSync(process.execPath, ['--eval', '']).pid;

const lease = (pid: number, since: number): Lease => ({ pid, since });

describe('leases', () => {
    test('isAlive — this process lives, one that exited does not', () => {
        // Given - this process, init (alive, though this user may not signal it), a child that has exited, no pid, and one that is no whole number
        // Then - this process and init live
        expect([
            isAlive(process.pid),
            isAlive(1),
            isAlive(deadPid()),
            isAlive(undefined),
            isAlive(1.5),
        ]).toStrictEqual([true, true, false, false, false]);
    });

    test('liveLeases — the live leases oldest first, a tie by pid; the dead and a name that is no pid taken away; an unreadable lease kept with no age', () => {
        // Given - no folder, then a folder holding two live leases out of order, a garbled one, a dead one and a stray name
        machineFolder();
        const none = liveLeases();
        leaseTaken(process.pid, '/b');
        mkdirSync(leaseFolder(), { recursive: true });
        writeFileSync(join(leaseFolder(), String(process.ppid)), '{"root":"/a","since":1}\n');
        writeFileSync(join(leaseFolder(), '1'), 'garbled');
        const dead = String(deadPid());
        writeFileSync(join(leaseFolder(), dead), '{"root":"/c","since":2}\n');
        writeFileSync(join(leaseFolder(), 'stray'), '{}');
        const leases = liveLeases();

        // Then - none at first; the garbled lease first, the parent's next, this process's last, and only the live are left
        expect([none, leases.map(({ pid }) => pid)]).toStrictEqual([
            [],
            [1, process.ppid, process.pid],
        ]);
        expect(leases[2]?.since).toBeGreaterThan(2);
        expect(readdirSync(leaseFolder()).toSorted()).toStrictEqual(
            ['1', String(process.ppid), String(process.pid)].toSorted(),
        );
    });

    test('byAge — the older lease first, two of one age by pid', () => {
        // Given - three leases listed newest and largest pid first
        const leases = [lease(9, 2), lease(7, 1), lease(3, 1)];

        // Then - the age decides, then the pid
        expect(leases.toSorted(byAge).map(({ pid }) => pid)).toStrictEqual([3, 7, 9]);
    });

    test('liveLeases — two leases taken at the same moment rank by pid', () => {
        // Given - the larger pid written first, both of one age
        const held = folder();
        writeFileSync(join(held, String(process.pid)), '{"root":"/b","since":5}');
        writeFileSync(join(held, '1'), '{"root":"/a","since":5}');

        // Then - the smaller pid ranks first
        expect(liveLeases(held).map(({ pid }) => pid)).toStrictEqual([1, process.pid]);
    });

    test('gateOf — the gate named for this very checkout when it lives, else this process', () => {
        // Given - a checkout, and the gate variable naming a live gate for it, for another checkout, a dead gate, and no root
        const root = folder();
        const named = (value: string): number => gateOf(root, { [GATE_VARIABLE]: value });
        const dead = deadPid();

        // Then - only the live gate of this checkout is adopted
        expect([
            named(`${String(process.ppid)}:${root}`),
            named(`${String(process.ppid)}:${root}/elsewhere`),
            named(`${String(dead)}:${root}`),
            named(String(process.ppid)),
            gateOf(join(root, 'other'), {
                [GATE_VARIABLE]: `${String(process.ppid)}:${root}/gone`,
            }),
            gateOf(join(root, 'gone'), {
                [GATE_VARIABLE]: `${String(process.ppid)}:${root}/gone/`,
            }),
            gateOf(root, {}),
        ]).toStrictEqual([
            process.ppid,
            process.pid,
            process.pid,
            process.pid,
            process.pid,
            process.ppid,
            process.pid,
        ]);
    });
});
