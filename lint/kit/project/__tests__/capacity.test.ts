import { spawnSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { availableParallelism, tmpdir, totalmem } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import {
    byAge,
    CAPACITY_VARIABLE,
    capacityLine,
    capacityNamed,
    capacityUnread,
    capacityValue,
    isAlive,
    leaseFolder,
    leaseTaken,
    liveLeases,
    machineOf,
    priceLearned,
    priceOf,
    PRICES_FILE,
    priceText,
    SEED_PRICES,
    sliceOf,
    slots,
    slotsFor,
} from '../capacity.js';
import type { Lease, Machine } from '../capacity.js';

const MB = 1024 ** 2;

const GB = 1024 ** 3;

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

const machine = (cpus: number, memory: number, available = memory): Machine => ({
    available,
    cpus,
    given: false,
    memory,
});

const lease = (pid: number, since: number): Lease => ({ pid, root: '/repo', since });

describe('capacity', () => {
    test('capacityNamed — nothing unset or blank; cpus, memory in k, m or g, or both; anything else unreadable', () => {
        // Given - the variable unset, blank, each part alone, both padded and in either order, and seven spellings of no capacity
        // Then - each spelling reads as the gate reads it
        expect(
            [
                undefined,
                ' ',
                'cpus=4',
                'memory=512m',
                ' memory = 1.5G , cpus=3 ',
                'memory=8k',
                'memory=1.25g',
                'cpus=0',
                'cpus=2.5',
                'memory=4',
                'memory=0g',
                'cpus=2,cpus=3',
                'cpus=2,',
                'threads=2',
                'cpus=4g',
                'memory=x4g',
                'memory=4gb',
                'cpus',
            ].map((value) => capacityNamed(value)),
        ).toStrictEqual([
            undefined,
            undefined,
            { cpus: 4 },
            { memory: 512 * MB },
            { cpus: 3, memory: 1.5 * GB },
            { memory: 8 * 1024 },
            { memory: 1.25 * GB },
            'unreadable',
            'unreadable',
            'unreadable',
            'unreadable',
            'unreadable',
            'unreadable',
            'unreadable',
            'unreadable',
            'unreadable',
            'unreadable',
            'unreadable',
        ]);
    });

    test('capacityValue — a capacity written back as the variable reads it, its memory in whole megabytes', () => {
        // Given - three cpus and a memory that is no whole number of megabytes
        const written = capacityValue({ cpus: 3, memory: 1.5 * GB + 1000 });

        // Then - it is written in megabytes, and reads back to those megabytes
        expect([written, capacityNamed(written)]).toStrictEqual([
            'cpus=3,memory=1536m',
            { cpus: 3, memory: 1536 * MB },
        ]);
    });

    test('capacityUnread — names the variable and what it holds, why it is refused and how to write it', () => {
        // Given - a variable that holds a word
        // Then - the found part names the value
        expect(capacityUnread('many')).toStrictEqual({
            fix: "write it cpus=<count>,memory=<size> (cpus=4,memory=8g), either part alone, or leave it unset to take this gate's share of the machine",
            found: 'TYPESCRIPT_CAPACITY is many, which names no capacity',
            why: 'a capacity read wrong would size every pool of the gate from a machine that is not there',
        });
    });

    test('machineOf — a capacity given is the machine whole; a part not given is read from the machine', () => {
        // Given - both parts given, cpus alone, and nothing
        const both = machineOf({ cpus: 3, memory: 4 * GB });
        const cpus = machineOf({ cpus: 2 });
        const read = machineOf(undefined);

        // Then - the given parts stand, the memory read is the machine's, and what is free is no more than it
        expect([both, { ...cpus, available: 0 }, { ...read, available: 0 }]).toStrictEqual([
            { available: 4 * GB, cpus: 3, given: true, memory: 4 * GB },
            { available: 0, cpus: 2, given: true, memory: totalmem() },
            { available: 0, cpus: availableParallelism(), given: false, memory: totalmem() },
        ]);
        expect(read.available).toBeGreaterThan(0);
        expect(read.available).toBeLessThan(read.memory);
    });

    test('slots — the cpus, fewer where the memory binds, never none', () => {
        // Given - a price of 500 MB on slices where the cpus bind, where the memory binds, at the edge, and where it holds none
        // Then - each holds the least of the two, and one at the least
        expect([
            slots({ cpus: 3, memory: 64 * GB }, 500 * MB),
            slots({ cpus: 16, memory: GB }, 500 * MB),
            slots({ cpus: 16, memory: 1500 * MB }, 500 * MB),
            slots({ cpus: 16, memory: 1499 * MB }, 500 * MB),
            slots({ cpus: 4, memory: 0 }, 500 * MB),
        ]).toStrictEqual([3, 2, 3, 2, 1]);
    });

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

    test('liveLeases — the live leases oldest first, a tie by pid; the dead and a name that is no pid taken away; an unreadable lease kept with no root or age', () => {
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
        expect([none, leases.map(({ pid, root }) => [pid, root])]).toStrictEqual([
            [],
            [
                [1, 'undefined'],
                [process.ppid, '/a'],
                [process.pid, '/b'],
            ],
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

    test('sliceOf — a capacity given is the whole slice, less an eighth of the memory', () => {
        // Given - a given machine of 16 cpus and 1 GB, among leases of other gates
        const given = { ...machine(16, GB), given: true };

        // Then - every cpu, seven eighths of the memory, one gate
        expect(sliceOf(given, [lease(1, 0), lease(2, 0)], 3)).toStrictEqual({
            cpus: 16,
            gates: 1,
            memory: 896 * MB,
        });
    });

    test('sliceOf — the gates share the cpus by rank so the shares add up to the machine, the memory alike, bounded by what is free', () => {
        // Given - ten cpus and 16 GB, all free, shared by three gates; then 6 GB free; then a gate holding no lease beside two
        const shared = machine(10, 16 * GB);
        const leases = [lease(7, 1), lease(5, 2), lease(9, 3)];
        const ranked = [7, 5, 9].map((pid) => sliceOf(shared, leases, pid));
        const tight = sliceOf(machine(10, 16 * GB, 6 * GB), leases, 7);
        const unleased = sliceOf(shared, leases.slice(0, 2), 4);

        // Then - 4, 3 and 3 cpus with their part of 14 GB; the free memory less the reserve binds; the unleased gate is the third
        expect([...ranked, tight, unleased]).toStrictEqual([
            { cpus: 4, gates: 3, memory: Math.floor(14 * GB * 0.4) },
            { cpus: 3, gates: 3, memory: Math.floor(14 * GB * 0.3) },
            { cpus: 3, gates: 3, memory: Math.floor(14 * GB * 0.3) },
            { cpus: 4, gates: 3, memory: 4 * GB },
            { cpus: 3, gates: 3, memory: Math.floor(14 * GB * 0.3) },
        ]);
    });

    test('sliceOf — more gates than cpus still leaves each one; no lease leaves the machine whole', () => {
        // Given - two cpus shared by three gates, and a machine no gate leases
        const two = machine(2, 4 * GB);
        const leases = [lease(1, 1), lease(2, 2), lease(3, 3)];

        // Then - one cpu each, and the lone gate takes both
        expect([
            sliceOf(two, leases, 3).cpus,
            sliceOf(two, [], process.pid),
            sliceOf(machine(3, 4 * GB, 0), [], process.pid).memory,
        ]).toStrictEqual([1, { cpus: 2, gates: 1, memory: 3.5 * GB }, 0]);
    });

    test('capacityLine — the machine as read or given, then this gate’s slice', () => {
        // Given - a read machine shared by two gates, and a given one
        // Then - the read one says what is free and how many gates share it, the given one names the variable
        expect([
            capacityLine(machine(10, 16 * GB, 6.4 * GB), { cpus: 5, gates: 2, memory: 4.4 * GB }),
            capacityLine(
                { ...machine(3, 4 * GB), given: true },
                { cpus: 3, gates: 1, memory: 3.5 * GB },
            ),
        ]).toStrictEqual([
            'capacity: 10 cpus, 16.0 GB, 6.4 GB available, 2 gate(s): this gate 5 cpus, 4.4 GB',
            'capacity: 3 cpus, 4.0 GB, given by TYPESCRIPT_CAPACITY: this gate 3 cpus, 3.5 GB',
        ]);
    });

    test('priceText — a price in whole megabytes', () => {
        // Given - a round price and one a fraction above a megabyte
        // Then - rounded to the nearest megabyte
        expect([priceText(500 * MB), priceText(1.6 * MB)]).toStrictEqual(['500 MB', '2 MB']);
    });

    test('priceOf — the seed until a peak is learned, then the highest of the last five, other pools kept', () => {
        // Given - a project with no prices, then seven peaks learned for the suite and one for the modules
        const project = folder();
        const seeded = priceOf(project, 'stryker-suite');
        for (const peak of [900, 100, 200, 300, 400, 500, 600]) {
            priceLearned(project, 'stryker-suite', peak * MB + 0.4);
        }
        priceLearned(project, 'stryker-modules', 250 * MB);

        const written: unknown = JSON.parse(readFileSync(join(project, PRICES_FILE), 'utf8'));

        // Then - the seed, then 600 MB of the last five (900 dropped), each pool on its own, and the checker still seeded
        expect([
            seeded,
            priceOf(project, 'stryker-suite'),
            priceOf(project, 'stryker-modules'),
            priceOf(project, 'checker'),
            written,
        ]).toStrictEqual([
            SEED_PRICES['stryker-suite'],
            600 * MB,
            250 * MB,
            400 * MB,
            {
                'stryker-modules': [250 * MB],
                'stryker-suite': [200, 300, 400, 500, 600].map((peak) => peak * MB),
            },
        ]);
    });

    test('priceOf — an unreadable file, or peaks that are no positive numbers, leave the seed', () => {
        // Given - one project whose prices file is garbled, one whose peaks are no prices
        const garbled = folder();
        mkdirSync(join(garbled, '.artifacts'));
        writeFileSync(join(garbled, PRICES_FILE), 'garbled');
        const empty = folder();
        mkdirSync(join(empty, '.artifacts'));
        writeFileSync(join(empty, PRICES_FILE), '{"vitest":[0,-3,"x"],"checker":7}');

        // Then - the seeds, and a learned peak writes the file again
        priceLearned(garbled, 'vitest', 90 * MB);
        expect([
            priceOf(empty, 'vitest'),
            priceOf(empty, 'checker'),
            priceOf(garbled, 'vitest'),
        ]).toStrictEqual([150 * MB, 400 * MB, 90 * MB]);
    });

    test('slotsFor — the pool’s slots of the capacity given, priced in the project, never divided among the gates', () => {
        // Given - a machine where two other gates hold leases, and a project whose vitest price is learned
        machineFolder();
        leaseTaken(1, '/elsewhere');
        leaseTaken(process.ppid, '/other');
        const project = folder();
        priceLearned(project, 'vitest', GB);
        const environment = { [CAPACITY_VARIABLE]: 'cpus=8,memory=4g' };

        // Then - 3.5 GB holds three 1 GB workers; the cpus bind under a large memory; a project with no price takes the seed
        expect([
            slotsFor(project, 'vitest', environment),
            slotsFor(project, 'vitest', { [CAPACITY_VARIABLE]: 'cpus=2,memory=64g' }),
            slotsFor(folder(), 'checker', environment),
        ]).toStrictEqual([3, 2, 8]);
    });

    test('slotsFor — a machine read is shared among the gates, the lease on this checkout counted as the run’s own; a capacity the variable cannot read is refused', () => {
        // Given - the oldest lease on this checkout, two newer ones of other gates, and a price no memory binds
        machineFolder();
        const project = folder();
        priceLearned(project, 'vitest', 1);
        mkdirSync(leaseFolder(), { recursive: true });
        writeFileSync(
            join(leaseFolder(), String(process.pid)),
            JSON.stringify({ root: project, since: 0 }),
        );
        writeFileSync(join(leaseFolder(), '1'), '{"root":"/elsewhere","since":1}');
        writeFileSync(join(leaseFolder(), String(process.ppid)), '{"root":"/other","since":2}');
        const cpus = availableParallelism();
        const elsewhere = folder();
        priceLearned(elsewhere, 'vitest', 1);

        // Then - this run ranks first of three gates, a run from another checkout last of four, and the unreadable variable throws the refusal
        expect([slotsFor(project, 'vitest', {}), slotsFor(elsewhere, 'vitest', {})]).toStrictEqual([
            Math.floor(cpus / 3) + (cpus % 3 > 0 ? 1 : 0),
            Math.max(1, Math.floor(cpus / 4)),
        ]);
        expect(() => slotsFor(project, 'vitest', { [CAPACITY_VARIABLE]: 'lots' })).toThrow(
            "found: TYPESCRIPT_CAPACITY is lots, which names no capacity · why: a capacity read wrong would size every pool of the gate from a machine that is not there · fix: write it cpus=<count>,memory=<size> (cpus=4,memory=8g), either part alone, or leave it unset to take this gate's share of the machine · read: docs/reference/quality-checks.md#how-many-test-runners",
        );
    });
});
