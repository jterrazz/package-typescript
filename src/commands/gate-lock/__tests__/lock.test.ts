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

import {
    activeGates,
    foreignHolderOf,
    GATE_LOCK,
    GATE_VARIABLE,
    gateOf,
    gatesFolder,
    holderOf,
    isAlive,
    refusedWhileGated,
    withGateLock,
} from '../lock.js';

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
    test('isAlive — this process lives, one that exited does not', () => {
        // Given - this process, init — alive, though this user may not signal it —, a child that has exited, no pid, and one that is no whole number
        const dead = deadPid();

        // Then - this process and init live
        expect([
            isAlive(process.pid),
            isAlive(1),
            isAlive(dead),
            isAlive(undefined),
            isAlive(1.5),
        ]).toStrictEqual([true, true, false, false, false]);
    });

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

        // Then - the parent holds the first alone, and neither the process group nor every process — pids 0 and -1, which a signal reaches — holds anything
        expect([holderOf(live), holderOf(stale), holderOf(none), holderOf(garbled)]).toStrictEqual([
            process.ppid,
            undefined,
            undefined,
            undefined,
        ]);
        expect(signalled).toStrictEqual([undefined, undefined]);
    });

    test('gateOf — the gate named for this very checkout when it lives, else this process', () => {
        // Given - a checkout, and the gate variable naming a live gate for it, for another checkout, a dead gate, and no root
        const root = project();
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
            `found: the gate of pid ${String(process.ppid)} holds this checkout (.artifacts/gate.lock) · why: a build replaces what a running gate reads — its build, its install — and the gate would judge a tree that changed under it · fix: wait for pid ${String(process.ppid)} to end, or run a build in a worktree of its own · read: docs/reference/quality-checks.md#one-gate-per-checkout`,
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

    test('withGateLock — a step of a named gate holds and registers in its name, leaves both, and hands the name back as it found it; a checkout another gate holds is run and left as it was', async () => {
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

        // Then - the named gate keeps the first and its registration, the other gate the second, the name is back, and the run's answer comes back
        expect([
            readFileSync(join(stepped, GATE_LOCK), 'utf8'),
            readdirSync(gatesFolder()),
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

    test('activeGates — counts the live gates registered on the machine, takes away the dead, and counts this one when none is', () => {
        // Given - a machine whose registry holds a live gate, this one, a dead one and a name that is no pid
        const machine = project();
        vi.stubEnv('TMPDIR', machine);
        onTestFinished(() => {
            vi.unstubAllEnvs();
        });
        const none = activeGates();
        mkdirSync(gatesFolder(), { recursive: true });
        for (const name of [
            String(process.ppid),
            String(process.pid),
            String(deadPid()),
            'stray',
        ]) {
            writeFileSync(join(gatesFolder(), name), '/repo\n');
        }

        // Then - one with no registry, two live ones after, and only they are left
        expect([none, activeGates(), readdirSync(gatesFolder()).toSorted()]).toStrictEqual([
            1,
            2,
            [String(process.ppid), String(process.pid)].toSorted(),
        ]);
    });

    test("withGateLock — a gate registers on the machine while it runs; a run nested in another checkout's gate registers nothing", async () => {
        // Given - a machine of its own, a checkout run as its own gate, then one run inside the parent's gate of another checkout
        const machine = project();
        vi.stubEnv('TMPDIR', machine);
        gateNamed(undefined);
        const root = project();
        const during = await withGateLock(root, async () => {
            await Promise.resolve();

            return readdirSync(gatesFolder());
        });
        const after = readdirSync(gatesFolder());
        gateNamed(`${String(process.ppid)}:${machine}`);
        const nested = await withGateLock(project(), async () => {
            await Promise.resolve();

            return readdirSync(gatesFolder());
        });

        // Then - this process is registered during its run alone, the nested run adds nobody, and hands back the outer gate's name
        expect([during, after, nested]).toStrictEqual([[String(process.pid)], [], []]);
        expect(process.env[GATE_VARIABLE]).toBe(`${String(process.ppid)}:${machine}`);
    });
});
