import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';

import { ARTIFACTS } from './build-plan.js';
import { capacityGiven, machineOf, SEED_PRICES, SEED_TOOLS, sliceOf, slots } from './capacity.js';
import type { Cost, Pool } from './capacity.js';
import { listOf, parsedObject } from './json.js';
import { gateOf, liveLeases } from './leases.js';

/** The learned prices of a project: each pool's last measured highs per worker, and, under `<pool> tool`, its tool's. */
export const COSTS_FILE = `${ARTIFACTS}/costs.json`;

const KEPT_PEAKS = 5;

function peaksIn(project: string): Readonly<Record<string, unknown>> {
    try {
        const text = String(readFileSync(join(project, COSTS_FILE)));

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

const recordedOf = (project: string, key: string): number[] =>
    listOf(peaksIn(project)[key])
        .map(Number)
        .filter((peak) => peak > 0);

const toolKey = (pool: Pool): string => `${pool} tool`;

// value: what one Vitest worker holds falls as workers are added, so a price learned on one worker would size every later run to one; no run tells memory short yet, so the seed bounds it.
const CAPPED_AT_SEED: ReadonlySet<Pool> = new Set<Pool>(['vitest']);

/** What one worker of a pool costs in a project: the median of its last measured highs, so one run out of line neither pins nor drops it, else the pool's seed; a Vitest worker never above its seed. */
export function priceOf(project: string, pool: Pool): number {
    const peaks = recordedOf(project, pool);
    const learned = peaks.length === 0 ? SEED_PRICES[pool] : medianOf(peaks);

    return CAPPED_AT_SEED.has(pool) ? Math.min(learned, SEED_PRICES[pool]) : learned;
}

/** What a pool costs in a project: its tool, held once, and each worker, each the median of its last measured highs, else its seed. */
export function costOf(project: string, pool: Pool): Cost {
    const tools = recordedOf(project, toolKey(pool));

    return {
        tool: tools.length === 0 ? SEED_TOOLS[pool] : medianOf(tools),
        worker: priceOf(project, pool),
    };
}

function recorded(project: string, key: string, value: number): void {
    const peaks = peaksIn(project);
    const file = join(project, COSTS_FILE);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
        file,
        `${JSON.stringify({ ...peaks, [key]: [...listOf(peaks[key]), Math.round(value)].slice(-KEPT_PEAKS) }, null, 4)}\n`,
    );
}

/** Records what one worker of a pool held in `project`, in bytes, keeping the last five: what a pool's runner hands back after it measured its workers, so the next `slotsFor` prices them by the median of the five. */
export function priceLearned(project: string, pool: Pool, peak: number): void {
    recorded(project, pool, peak);
}

// value: the ninth decile of a run's samples, not their most: a brief spike (a spec that starts a gate, a build) held by one worker for a few seconds is no price every worker pays for the whole run, and the reserve of an eighth absorbs it.
const HIGH = 0.9;

/** The high a run's samples hold: their ninth decile, by nearest rank; none where no sample was taken. */
export function highOf(samples: readonly number[]): number | undefined {
    const sorted = samples.toSorted((a, b) => a - b);

    return sorted[Math.ceil(sorted.length * HIGH) - 1];
}

/** Learns a pool's cost in `project` from what a run's tools and workers held, sampled: the high of the tools, held once, and the high of everything below them shared by its workers; samples that saw nothing teach nothing. */
export function costLearned(
    project: string,
    pool: Pool,
    held: { below: readonly number[]; tools: readonly number[]; workers: number },
): void {
    const below = highOf(held.below) ?? 0;
    const tools = highOf(held.tools) ?? 0;
    if (below > 0) {
        priceLearned(project, pool, below / held.workers);
    }
    if (tools > 0) {
        recorded(project, toolKey(pool), tools);
    }
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
        costOf(project, pool),
    );
}
