import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import {
    CAPACITY_VARIABLE,
    capacityLine,
    capacityValue,
    machineOf,
    priceText,
    sliceOf,
} from '../../../lint/kit/project/capacity.js';
import type { Pool, Resources, Slice } from '../../../lint/kit/project/capacity.js';
import { withEnvironment } from '../../../lint/kit/project/environment.js';
import { gateOf, liveLeases } from '../../../lint/kit/project/leases.js';
import { STAGES } from '../../../lint/kit/project/mutation-stages.js';
import type { StageName } from '../../../lint/kit/project/mutation-stages.js';
import { APART_VARIABLE, apartIn, heldApart } from '../../../lint/kit/project/priced-apart.js';
import { costLearned, costOf, priceOf } from '../../../lint/kit/project/prices.js';
import { residentWatch } from '../../drivers/ps/ps.js';
import type { Resident } from '../../drivers/ps/ps.js';
import { runnerSlice, runnersOf } from '../../drivers/stryker/concurrency.js';
import type { Runners } from '../../drivers/stryker/concurrency.js';
import { typeCheckedIn } from '../../drivers/stryker/stryker.js';

// Stryker disable next-line ArithmeticOperator: the period only sets how finely a stage's memory is sampled, which no verdict reads
const SAMPLED_EVERY_MS = 2 * 1000;

/** What a stage leased: its pool, the test runners it hands Stryker, the slice each runner hands what its tests spawn, and the line that says so. */
export type StageLease = { handed: Resources; line: string; pool: Pool; runners: number };

/** This gate's share of the machine now: the leases read again, so a gate started since takes its part. */
export const sliceNow = (named: Partial<Resources> | undefined, project: string): Slice =>
    sliceOf(machineOf(named), liveLeases(), gateOf(project));

const sizedText = (
    { binds, checkers, runners }: Runners,
    prices: { checker: number; runner: number; tool: number },
): string =>
    `Stryker at ${priceText(prices.tool)}, ${String(runners)} test runner(s) at ${priceText(prices.runner)}${checkers === 0 ? '' : `, ${String(checkers)} checker(s) at ${priceText(prices.checker)} while checking`}: ${binds === 'cpus' ? 'cpus bind' : 'memory binds'}`;

/** Sizes a stage from this gate's share of the machine now and the prices its project learned. */
export function stageLease(
    named: Partial<Resources> | undefined,
    project: string,
    stage: StageName,
): StageLease {
    const { pool } = STAGES[stage];
    const machine = machineOf(named);
    const slice = sliceNow(named, project);
    const cost = costOf(project, pool);
    const prices = { checker: priceOf(project, 'checker'), runner: cost.worker, tool: cost.tool };
    const sized = runnersOf(slice, {
        checker: typeCheckedIn(project) ? prices.checker : undefined,
        runner: prices.runner,
        tool: prices.tool,
    });

    return {
        handed: runnerSlice(slice, sized.runners, cost),
        line: `${capacityLine(machine, slice)} · ${sizedText(sized, prices)}`,
        pool,
        runners: sized.runners,
    };
}

/** Learns a stage's cost from what its run held, sampled: Stryker's own process once, and what its test runners held shared among them. */
export const samplesPriced = (
    project: string,
    lease: StageLease,
    samples: readonly Resident[],
): void => {
    costLearned(project, lease.pool, {
        below: samples.map(({ below }) => below),
        tools: samples.map(({ tools }) => tools),
        workers: lease.runners,
    });
};

/** Runs a stage on its lease: priced apart from the test runner of an outer stage that started this gate, each of its own runners' slice handed on, the memory of Stryker and of what it started watched (a process priced apart left out), and the cost learned from the samples, a failed run's too. */
export async function leasedRun<T>(
    project: string,
    lease: StageLease,
    run: () => Promise<T>,
): Promise<T> {
    const released = heldApart();
    // Stryker disable next-line StringLiteral: the prefix only names the folder for a reader of the temp folder; mkdtemp makes it unique whatever it is
    const apart = mkdtempSync(join(tmpdir(), 'typescript-apart-'));
    const watch = residentWatch(process.pid, SAMPLED_EVERY_MS, { apart: () => apartIn(apart) });
    try {
        return await withEnvironment(
            { [APART_VARIABLE]: apart, [CAPACITY_VARIABLE]: capacityValue(lease.handed) },
            run,
        );
    } finally {
        samplesPriced(project, lease, watch.stop());
        rmSync(apart, { recursive: true });
        released();
    }
}
