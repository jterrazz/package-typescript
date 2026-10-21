import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { CAPACITY_VARIABLE, SEED_PRICES } from '../capacity.js';
import { GATE_VARIABLE, leaseFolder, leaseTaken } from '../leases.js';
import { priceLearned, priceOf, PRICES_FILE, slotsFor } from '../prices.js';

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

describe('prices', () => {
    test('priceOf — the seed until a peak is learned, then the median of the last five, other pools kept', () => {
        // Given - a project with no prices, then seven peaks learned for the suite and one for the modules
        const project = folder();
        const seeded = priceOf(project, 'stryker-suite');
        for (const peak of [900, 100, 600, 300, 400, 200, 500]) {
            priceLearned(project, 'stryker-suite', peak * MB + 0.4);
        }
        priceLearned(project, 'stryker-modules', 250 * MB);

        const written: unknown = JSON.parse(readFileSync(join(project, PRICES_FILE), 'utf8'));

        // Then - the seed, then 400 MB, the median of the last five (900 and 100 dropped), each pool on its own, and the checker still seeded
        expect([
            seeded,
            priceOf(project, 'stryker-suite'),
            priceOf(project, 'stryker-modules'),
            priceOf(project, 'checker'),
            written,
        ]).toStrictEqual([
            SEED_PRICES['stryker-suite'],
            400 * MB,
            250 * MB,
            720 * MB,
            {
                'stryker-modules': [250 * MB],
                'stryker-suite': [600, 300, 400, 200, 500].map((peak) => peak * MB),
            },
        ]);
    });

    test('priceOf — a price learned high falls back once three normal runs follow it', () => {
        // Given - a project whose first two runs measured about 4 GB a runner, then three about 500 MB
        const project = folder();
        const prices = [4096, 3700, 520, 500, 510].map((peak) => {
            priceLearned(project, 'stryker-suite', peak * MB);

            return priceOf(project, 'stryker-suite') / MB;
        });

        // Then - the median after each run, an even count taking the mean of its middle two
        expect(prices).toStrictEqual([4096, 3898, 3700, 2110, 520]);
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
        ]).toStrictEqual([600 * MB, 720 * MB, 90 * MB]);
    });

    test('slotsFor — the pool’s slots of the capacity given, priced in the project, never divided among the gates', () => {
        // Given - a machine where two other gates hold leases, and a project whose vitest price is learned
        machineFolder();
        leaseTaken(1, '/elsewhere');
        leaseTaken(process.ppid, '/other');
        const project = folder();
        priceLearned(project, 'vitest', GB);
        const environment = { [CAPACITY_VARIABLE]: 'cpus=8,memory=4g' };

        // Then - 3.5 GB holds three 1 GB workers; the cpus bind under a large memory; a project with no price takes the seed, four 720 MB checkers in 3.5 GB
        expect([
            slotsFor(project, 'vitest', environment),
            slotsFor(project, 'vitest', { [CAPACITY_VARIABLE]: 'cpus=2,memory=64g' }),
            slotsFor(folder(), 'checker', environment),
        ]).toStrictEqual([3, 2, 4]);
    });

    test('slotsFor — a machine read is shared among the gates, the lease of the gate this run is a step of counted as its own; a capacity the variable cannot read is refused', () => {
        // Given - the oldest lease, held by the gate this run is a step of on its checkout, two newer ones of other live gates, and a price no memory binds
        machineFolder();
        const project = folder();
        priceLearned(project, 'vitest', 1);
        mkdirSync(leaseFolder(), { recursive: true });
        writeFileSync(
            join(leaseFolder(), String(process.ppid)),
            JSON.stringify({ root: project, since: 0 }),
        );
        writeFileSync(join(leaseFolder(), '1'), '{"root":"/elsewhere","since":1}');
        const other = spawn(process.execPath, ['--eval', 'setTimeout(() => {}, 60000)']);
        onTestFinished(() => {
            other.kill();
        });
        writeFileSync(join(leaseFolder(), String(other.pid)), '{"root":"/other","since":2}');
        const gate = { [GATE_VARIABLE]: `${String(process.ppid)}:${project}` };
        const cpus = availableParallelism();
        const elsewhere = folder();
        priceLearned(elsewhere, 'vitest', 1);

        // Then - this run ranks first of three gates, a run of the same gate in another checkout last of four, and the unreadable variable throws the refusal
        expect([
            slotsFor(project, 'vitest', gate),
            slotsFor(elsewhere, 'vitest', gate),
        ]).toStrictEqual([
            Math.floor(cpus / 3) + (cpus % 3 > 0 ? 1 : 0),
            Math.max(1, Math.floor(cpus / 4)),
        ]);
        expect(() => slotsFor(project, 'vitest', { [CAPACITY_VARIABLE]: 'lots' })).toThrow(
            "found: TYPESCRIPT_CAPACITY is lots, which names no capacity · why: a capacity read wrong would size every pool of the gate from a machine that is not there · fix: write it cpus=<count>,memory=<size> (cpus=4,memory=8g), either part alone, or leave it unset to take this gate's share of the machine · read: docs/reference/quality-checks.md#how-many-test-runners",
        );
    });
});
