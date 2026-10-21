import { availableParallelism, totalmem } from 'node:os';
import process from 'node:process';
import { describe, expect, test } from 'vitest';

import {
    capacityGiven,
    capacityLine,
    capacityNamed,
    capacityUnread,
    capacityValue,
    machineOf,
    priceText,
    sliceOf,
    slots,
} from '../capacity.js';
import type { Machine } from '../capacity.js';
import type { Lease } from '../leases.js';

const MB = 1024 ** 2;

const GB = 1024 ** 3;

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

    test('capacityGiven — none unset, the capacity the variable names, and a refusal that reads the manual for one it cannot read', () => {
        // Given - the variable unset, naming two cpus, and naming a word
        // Then - nothing, the two cpus, and the four-part refusal
        expect([capacityGiven({}), capacityGiven({ TYPESCRIPT_CAPACITY: 'cpus=2' })]).toStrictEqual(
            [undefined, { cpus: 2 }],
        );
        expect(() => capacityGiven({ TYPESCRIPT_CAPACITY: 'lots' })).toThrow(
            'found: TYPESCRIPT_CAPACITY is lots, which names no capacity · why: ',
        );
        expect(() => capacityGiven({ TYPESCRIPT_CAPACITY: 'lots' })).toThrow(
            ' · read: docs/reference/quality-checks.md#how-many-test-runners',
        );
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
});
