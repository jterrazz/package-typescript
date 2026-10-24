import process from 'node:process';

import {
    capacityGiven,
    capacityLine,
    machineOf,
    priceText,
    sliceOf,
    slots,
} from '../../../lint/kit/project/capacity.js';
import { gateOf, liveLeases } from '../../../lint/kit/project/leases.js';
import { costLearned, costOf } from '../../../lint/kit/project/prices.js';
import { residentWatch } from '../../drivers/ps/ps.js';
import { handsFilesTo } from '../mutation/record/test-files.js';

// Stryker disable next-line ArithmeticOperator: the period only sets how finely a run's memory is sampled, which no verdict reads
const SAMPLED_EVERY_MS = 2 * 1000;

// outside: npm runs a script through `sh -c`, which runs a one-command script in its own process, so the Vitest a script starts sits two levels below this one, under npm.
const TOOL_DEPTH = 2;

/** What a test run leased: the Vitest workers it hands the script, and the line that says so; none where the script is no one `vitest` command or states its own count. */
export type TestLease = undefined | { line: string; workers: number };

/** Sizes a test run's Vitest workers from this gate's share of the machine now and the cost its project learned. */
export function testLease(
    project: string,
    script: string,
    environment: NodeJS.ProcessEnv = process.env,
): TestLease {
    if (!handsFilesTo(script) || script.includes('--maxWorkers')) {
        return undefined;
    }
    const machine = machineOf(capacityGiven(environment));
    const slice = sliceOf(machine, liveLeases(), gateOf(project, environment));
    const cost = costOf(project, 'vitest');
    const workers = slots(slice, cost);

    return {
        line: `${capacityLine(machine, slice)} · Vitest at ${priceText(cost.tool)}, ${String(workers)} worker(s) at ${priceText(cost.worker)}: ${workers < slice.cpus ? 'memory binds' : 'cpus bind'}`,
        workers,
    };
}

/** Runs the test script over `files` (none: every test file) on its lease: the workers handed to it, the memory of Vitest and of what its workers start watched, and the cost learned from a run of every test file, a failed one's too, since a run of a few files leaves workers idle and would price them short. */
export async function leasedTest(
    project: string,
    { files, lease }: { files: readonly string[]; lease: TestLease },
    run: (args: readonly string[]) => Promise<number>,
): Promise<number> {
    if (lease === undefined) {
        return await run(files);
    }
    const watch = residentWatch(process.pid, SAMPLED_EVERY_MS, { depth: TOOL_DEPTH });
    try {
        return await run([`--maxWorkers=${String(lease.workers)}`, ...files]);
    } finally {
        const samples = watch.stop();
        if (files.length === 0) {
            costLearned(project, 'vitest', {
                below: samples.map(({ below }) => below),
                tools: samples.map(({ tools }) => tools),
                workers: lease.workers,
            });
        }
    }
}
