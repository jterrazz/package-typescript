import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';

import { ARTIFACTS } from './build-plan.js';
import { capacityGiven, machineOf, SEED_PRICES, sliceOf, slots } from './capacity.js';
import type { Pool } from './capacity.js';
import { listOf, parsedObject } from './json.js';
import { gateOf, liveLeases } from './leases.js';

/** The learned prices of a project, each pool's last measured peaks per worker. */
export const PRICES_FILE = `${ARTIFACTS}/prices.json`;

const KEPT_PEAKS = 5;

function peaksIn(project: string): Readonly<Record<string, unknown>> {
    try {
        const text = String(readFileSync(join(project, PRICES_FILE)));

        return parsedObject(text);
    } catch {
        return {};
    }
}

const medianOf = (values: readonly number[]): number => {
    const sorted = values.toSorted((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 1
        ? Number(sorted[middle])
        : (Number(sorted[middle - 1]) + Number(sorted[middle])) / 2;
};

/** What one worker of a pool costs in a project: the median of its last measured peaks, so one peak out of line neither pins nor drops it, else the pool's seed. */
export function priceOf(project: string, pool: Pool): number {
    const peaks = listOf(peaksIn(project)[pool])
        .map(Number)
        .filter((peak) => peak > 0);

    return peaks.length === 0 ? SEED_PRICES[pool] : medianOf(peaks);
}

/** Records a peak measured per worker of a pool in `project`, in bytes, keeping the last five: what a pool's runner hands back after it measured its workers, so the next `slotsFor` prices them by the median of the five. */
export function priceLearned(project: string, pool: Pool, peak: number): void {
    const peaks = peaksIn(project);
    const file = join(project, PRICES_FILE);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
        file,
        `${JSON.stringify({ ...peaks, [pool]: [...listOf(peaks[pool]), Math.round(peak)].slice(-KEPT_PEAKS) }, null, 4)}\n`,
    );
}

/** How many workers of a pool a run in `project` may start: this machine's capacity, shared among the live gates, the gate this run is a step of in `project` counted as its own, sized by the pool's price there. */
export function slotsFor(
    project: string,
    pool: Pool,
    environment: NodeJS.ProcessEnv = process.env,
): number {
    const named = capacityGiven(environment);

    return slots(
        sliceOf(machineOf(named), liveLeases(), gateOf(project, environment)),
        priceOf(project, pool),
    );
}
