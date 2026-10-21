import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import {
    CAPACITY_VARIABLE,
    capacityLine,
    capacityValue,
    liveLeases,
    machineOf,
    priceLearned,
    priceOf,
    priceText,
    sliceOf,
} from '../../../lint/kit/project/capacity.js';
import type { Pool, Resources, Slice } from '../../../lint/kit/project/capacity.js';
import { APART_VARIABLE, apartIn, heldApart } from '../../../lint/kit/project/priced-apart.js';
import { residentPeak } from '../../drivers/ps/ps.js';
import { runnerSlice, runnersOf } from '../../drivers/stryker/concurrency.js';
import type { Runners } from '../../drivers/stryker/concurrency.js';
import type { StageName } from '../../drivers/stryker/reports.js';
import { typeCheckedIn } from '../../drivers/stryker/stryker.js';
import { gateOf } from '../gate-lock/lock.js';

// Stryker disable next-line ArithmeticOperator: the period only sets how finely a stage's peak is sampled, which no verdict reads
const SAMPLED_EVERY_MS = 2 * 1000;

/** What a stage leased: its pool, the test runners it hands Stryker, the slice each runner hands what its tests spawn, and the line that says so. */
export type StageLease = { handed: Resources; line: string; pool: Pool; runners: number };

/** This gate's share of the machine now: the leases read again, so a gate started since takes its part. */
export const sliceNow = (named: Partial<Resources> | undefined, project: string): Slice =>
    sliceOf(machineOf(named), liveLeases(), gateOf(project));

const sizedText = (
    { binds, checkers, runners }: Runners,
    prices: { checker: number; runner: number },
): string =>
    `${String(runners)} test runner(s) at ${priceText(prices.runner)}${checkers === 0 ? '' : `, ${String(checkers)} checker(s) at ${priceText(prices.checker)} while checking`}: ${binds === 'cpus' ? 'cpus bind' : 'memory binds'}`;

/** Sizes a stage from this gate's share of the machine now and the prices its project learned. */
export function stageLease(
    named: Partial<Resources> | undefined,
    project: string,
    stage: StageName,
): StageLease {
    const pool = stage === 'suite' ? 'stryker-suite' : 'stryker-modules';
    const machine = machineOf(named);
    const slice = sliceNow(named, project);
    const prices = { checker: priceOf(project, 'checker'), runner: priceOf(project, pool) };
    const sized = runnersOf(slice, {
        checker: typeCheckedIn(project) ? prices.checker : undefined,
        runner: prices.runner,
    });

    return {
        handed: runnerSlice(slice, sized.runners, prices.runner),
        line: `${capacityLine(machine, slice)} · ${sizedText(sized, prices)}`,
        pool,
        runners: sized.runners,
    };
}

/** Learns a stage's price from the most memory its test runners held at once, shared among them. */
export function peakPriced(project: string, lease: StageLease, peak: number | undefined): void {
    if (peak !== undefined && peak > 0) {
        priceLearned(project, lease.pool, peak / lease.runners);
    }
}

/** Runs `run` with `handed` as the capacity every gate it starts reads, and hands the variable back as it found it. */
export async function withCapacityHanded<T>(handed: Resources, run: () => Promise<T>): Promise<T> {
    const before = process.env[CAPACITY_VARIABLE];
    process.env[CAPACITY_VARIABLE] = capacityValue(handed);
    try {
        return await run();
    } finally {
        if (before === undefined) {
            Reflect.deleteProperty(process.env, CAPACITY_VARIABLE);
        } else {
            process.env[CAPACITY_VARIABLE] = before;
        }
    }
}

/** Runs a stage on its lease: priced apart from the test runner of an outer stage that started this gate, each of its own runners' slice handed on, the memory of what its tool started watched (a process priced apart left out), and the price learned from the peak, a failed run's too. */
export async function leasedRun<T>(
    project: string,
    lease: StageLease,
    run: () => Promise<T>,
): Promise<T> {
    const released = heldApart();
    const apart = mkdtempSync(join(tmpdir(), 'typescript-apart-'));
    const watch = residentPeak(process.pid, SAMPLED_EVERY_MS, () => apartIn(apart));
    const before = process.env[APART_VARIABLE];
    process.env[APART_VARIABLE] = apart;
    try {
        return await withCapacityHanded(lease.handed, run);
    } finally {
        if (before === undefined) {
            Reflect.deleteProperty(process.env, APART_VARIABLE);
        } else {
            process.env[APART_VARIABLE] = before;
        }
        peakPriced(project, lease, watch.stop());
        rmSync(apart, { force: true, recursive: true });
        released();
    }
}
