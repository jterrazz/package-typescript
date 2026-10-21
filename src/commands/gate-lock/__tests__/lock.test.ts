import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { parsedObject } from '../../../../lint/kit/project/json.js';
import { GATE_VARIABLE, leaseFolder } from '../../../../lint/kit/project/leases.js';
import { foreignHolderOf, GATE_LOCK, holderOf, refusedWhileGated, withGateLock } from '../lock.js';

function project(): string {
    const folder = mkdtempSync(join(tmpdir(), 'gate-lock-'));
    const made = realpathSync(folder);
    onTestFinished(() => {
        rmSync(made, { force: true, recursive: true });
    });

    return made;
}

function locked(root: string, text: string): void {
    mkdirSync(join(root, '.artifacts'), { recursive: true });
    writeFileSync(join(root, GATE_LOCK), text);
}

const deadPid = (): number => spawnSync(process.execPath, ['--eval', '']).pid;

function gateNamed(value: string | undefined): void {
    vi.stubEnv(GATE_VARIABLE, value);
    onTestFinished(() => {
        vi.unstubAllEnvs();
    });
}

describe('lock', () => {
    test('holderOf — a live pid holds the checkout; a dead one, no lock, or a lock that names no pid hold nothing', () => {
        // Given - four checkouts: held by the parent of this process, by a process that exited, not locked, and locked with words
        const live = project();
        locked(live, `${String(process.ppid)}\n`);
        const stale = project();
        locked(stale, String(deadPid()));
        const none = project();
        const garbled = project();
        locked(garbled, 'pid of nobody');
        const signalled = ['0', '-1'].map((text) => {
            const root = project();
            locked(root, text);

            return holderOf(root);
        });

        // Then - the parent holds the first alone, and neither the process group nor every process (pids 0 and -1, which a signal reaches) holds anything
        expect([holderOf(live), holderOf(stale), holderOf(none), holderOf(garbled)]).toStrictEqual([
            process.ppid,
            undefined,
            undefined,
            undefined,
        ]);
        expect(signalled).toStrictEqual([undefined, undefined]);
    });

    test('foreignHolderOf and refusedWhileGated — another live gate is named in four parts; the gate this process is a step of is none', () => {
        // Given - a checkout held by the parent of this process, first named as this process's gate, then not
        const root = project();
        locked(root, String(process.ppid));
        gateNamed(`${String(process.ppid)}:${root}`);
        const own = [foreignHolderOf(root), refusedWhileGated(root, 'a build')];
        gateNamed(undefined);

        // Then - no refusal inside its own gate, and outside it the holder named
        expect(own).toStrictEqual([undefined, undefined]);
        expect(foreignHolderOf(root)).toBe(process.ppid);
        expect(refusedWhileGated(root, 'a build')).toBe(
            `found: the gate of pid ${String(process.ppid)} holds this checkout (.artifacts/gate.lock) · why: a build replaces what a running gate reads (its build, its install), and the gate would judge a tree that changed under it · fix: wait for pid ${String(process.ppid)} to end, or run a build in a worktree of its own · read: docs/reference/quality-checks.md#one-gate-per-checkout`,
        );
    });

    test('withGateLock — takes a free or stale lock in its own name, names its gate to what it runs, and drops both at the end', async () => {
        // Given - a free checkout, and one a dead gate left locked
        gateNamed(undefined);
        const free = project();
        const stale = project();
        locked(stale, String(deadPid()));
        const seen: unknown[] = [];

        // When - each runs under the lock
        for (const root of [free, stale]) {
            const lock = join(root, GATE_LOCK);
            const during = await withGateLock(root, async () => {
                await Promise.resolve();

                return [readFileSync(lock, 'utf8'), process.env[GATE_VARIABLE]];
            });
            seen.push(during);
        }

        // Then - each was held by this process and named so, and left free
        expect(seen).toStrictEqual([
            [`${String(process.pid)}\n`, `${String(process.pid)}:${free}`],
            [`${String(process.pid)}\n`, `${String(process.pid)}:${stale}`],
        ]);
        expect([
            existsSync(join(free, GATE_LOCK)),
            existsSync(join(stale, GATE_LOCK)),
            process.env[GATE_VARIABLE],
        ]).toStrictEqual([false, false, undefined]);
    });

    test('withGateLock — a step of a named gate holds and leases in its name, leaves both, and hands the name back as it found it; a checkout another gate holds is run and left as it was', async () => {
        // Given - a machine of its own, a checkout whose gate is named as the parent of this process, and one the parent holds that this process is no step of
        const machine = project();
        vi.stubEnv('TMPDIR', machine);
        const stepped = project();
        const name = `${String(process.ppid)}:${stepped}`;
        gateNamed(name);
        await withGateLock(stepped, async () => {
            await Promise.resolve();
        });
        const named = process.env[GATE_VARIABLE];
        const other = project();
        locked(other, String(process.ppid));
        gateNamed(undefined);
        const ran = await withGateLock(other, async () => await Promise.resolve('ran'));

        // Then - the named gate keeps the first and its lease, the other gate the second, the name is back, and the run's answer comes back
        expect([
            readFileSync(join(stepped, GATE_LOCK), 'utf8'),
            readdirSync(leaseFolder()),
            named,
            readFileSync(join(other, GATE_LOCK), 'utf8'),
            ran,
        ]).toStrictEqual([
            `${String(process.ppid)}\n`,
            [String(process.ppid)],
            name,
            String(process.ppid),
            'ran',
        ]);
    });

    test('withGateLock — a lock another gate took over while the run went is left to it', async () => {
        // Given - a free checkout whose lock a second gate, the parent of this process, takes while the run goes
        gateNamed(undefined);
        const root = project();
        await withGateLock(root, async () => {
            await Promise.resolve();
            writeFileSync(join(root, GATE_LOCK), String(process.ppid));
        });

        // Then - the second gate's lock stands
        expect(readFileSync(join(root, GATE_LOCK), 'utf8')).toBe(String(process.ppid));
    });

    test('withGateLock — a run that throws still drops its lock', async () => {
        // Given - a free checkout and a run that fails
        gateNamed(undefined);
        const root = project();

        // Then - the failure reaches the caller, and the lock is gone
        await expect(
            withGateLock(root, async () => {
                await Promise.resolve();
                throw new Error('stopped');
            }),
        ).rejects.toThrow('stopped');
        expect(existsSync(join(root, GATE_LOCK))).toBe(false);
    });

    test("withGateLock — a gate leases its share of the machine while it runs, naming its checkout; a run nested in another checkout's gate leases nothing", async () => {
        // Given - a machine of its own, a checkout run as its own gate, then one run inside the parent's gate of another checkout
        const machine = project();
        vi.stubEnv('TMPDIR', machine);
        gateNamed(undefined);
        const root = project();
        const during = await withGateLock(root, async () => {
            await Promise.resolve();

            const [name = ''] = readdirSync(leaseFolder());
            const file = join(leaseFolder(), name);
            const lease = parsedObject(readFileSync(file, 'utf8'));

            return [[name, lease.root]];
        });
        const after = readdirSync(leaseFolder());
        gateNamed(`${String(process.ppid)}:${machine}`);
        const nested = await withGateLock(project(), async () => {
            await Promise.resolve();

            return readdirSync(leaseFolder());
        });

        // Then - this process holds a lease on its checkout during its run alone, the nested run adds none, and hands back the outer gate's name
        expect([during, after, nested]).toStrictEqual([[[String(process.pid), root]], [], []]);
        expect(process.env[GATE_VARIABLE]).toBe(`${String(process.ppid)}:${machine}`);
    });
});
