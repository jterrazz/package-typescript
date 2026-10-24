import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { CAPACITY_VARIABLE, SEED_PRICES, SEED_TOOLS } from '../capacity.js';
import { GATE_VARIABLE, leaseFolder, leaseTaken } from '../leases.js';
import {
    costLearned,
    costOf,
    COSTS_FILE,
    highOf,
    priceLearned,
    priceOf,
    slotsFor,
} from '../prices.js';

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

        const written: unknown = JSON.parse(readFileSync(join(project, COSTS_FILE), 'utf8'));

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
        writeFileSync(join(garbled, COSTS_FILE), 'garbled');
        const empty = folder();
        mkdirSync(join(empty, '.artifacts'));
        writeFileSync(join(empty, COSTS_FILE), '{"vitest":[0,-3,"x"],"checker":7}');

        // Then - the seeds, and a learned peak writes the file again
        priceLearned(garbled, 'vitest', 90 * MB);
        expect([
            priceOf(empty, 'vitest'),
            priceOf(empty, 'checker'),
            priceOf(garbled, 'vitest'),
        ]).toStrictEqual([600 * MB, 720 * MB, 90 * MB]);
    });

    test('priceOf — a Vitest worker learned above its seed is priced at the seed, below it as learned; a Stryker runner learned above its seed keeps what it learned', () => {
        // Given - a project whose Vitest workers learned 740 MB on one worker and whose suite runners learned 2 GB, and one whose Vitest workers learned 440 MB
        const high = folder();
        priceLearned(high, 'vitest', 740 * MB);
        priceLearned(high, 'stryker-suite', 2 * GB);
        const low = folder();
        priceLearned(low, 'vitest', 440 * MB);

        // Then - the 600 MB seed, the 2 GB learned, and the 440 MB learned
        expect([
            priceOf(high, 'vitest'),
            priceOf(high, 'stryker-suite'),
            priceOf(low, 'vitest'),
        ]).toStrictEqual([SEED_PRICES.vitest, 2 * GB, 440 * MB]);
    });

    test('highOf — the ninth decile of the samples by nearest rank, the most of a few, none of none', () => {
        // Given - twenty samples whose two highest are brief spikes, five samples, one, and none
        const twenty = [...Array.from({ length: 18 }, (_, index) => index + 1), 500, 900];

        // Then - the 18th of twenty, the 5th of five, the one, and nothing
        expect([highOf(twenty), highOf([5, 1, 4, 2, 3]), highOf([7]), highOf([])]).toStrictEqual([
            18,
            5,
            7,
            undefined,
        ]);
    });

    test('costLearned — the high of a run’s tools held once and of what is below them shared by its workers, each kept beside the other; samples of nothing teach nothing', () => {
        // Given - a project with no cost, then a Vitest run of four workers sampled ten times, and a run whose samples saw nothing
        const project = folder();
        const seeded = costOf(project, 'vitest');
        costLearned(project, 'vitest', {
            below: [...Array.from({ length: 9 }, () => 1600 * MB), 8 * GB],
            tools: [...Array.from({ length: 9 }, () => 600 * MB), 900 * MB],
            workers: 4,
        });
        costLearned(project, 'vitest', { below: [0], tools: [], workers: 4 });
        const written: unknown = JSON.parse(readFileSync(join(project, COSTS_FILE), 'utf8'));

        // Then - the seeds first, then 400 MB a worker and 600 MB for Vitest, the spikes left out, and nothing more for the empty run
        expect([seeded, costOf(project, 'vitest'), written]).toStrictEqual([
            { tool: SEED_TOOLS.vitest, worker: SEED_PRICES.vitest },
            { tool: 600 * MB, worker: 400 * MB },
            { vitest: [400 * MB], 'vitest tool': [600 * MB] },
        ]);
    });

    test('slotsFor — the pool’s slots of the capacity given, priced in the project, never divided among the gates', () => {
        // Given - a machine where two other gates hold leases, and a project whose vitest price is learned
        machineFolder();
        leaseTaken(1, '/elsewhere');
        leaseTaken(process.ppid, '/other');
        const project = folder();
        priceLearned(project, 'vitest', 500 * MB);
        const environment = { [CAPACITY_VARIABLE]: 'cpus=8,memory=4g' };

        // Then - 3.5 GB holds Vitest's seeded 300 MB and six 500 MB workers; the cpus bind under a large memory; a project with no price takes the seed, four 720 MB checkers in 3.5 GB, a checker's tool held by Stryker's
        expect([
            slotsFor(project, 'vitest', environment),
            slotsFor(project, 'vitest', { [CAPACITY_VARIABLE]: 'cpus=2,memory=64g' }),
            slotsFor(folder(), 'checker', environment),
        ]).toStrictEqual([6, 2, 4]);
    });

    test('slotsFor — a machine read is shared among the gates, the lease of the gate this run is a step of counted as its own; a capacity the variable cannot read is refused', () => {
        // Given - the oldest lease, held by the gate this run is a step of on its checkout, two newer ones of other live gates, and a price no memory binds
        machineFolder();
        const project = folder();
        costLearned(project, 'vitest', { below: [1], tools: [1], workers: 1 });
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
        costLearned(elsewhere, 'vitest', { below: [1], tools: [1], workers: 1 });

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
