import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';

import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { ARTIFACTS } from '../../../lint/kit/project/build-plan.js';
import { withEnvironment } from '../../../lint/kit/project/environment.js';
import {
    GATE_VARIABLE,
    gateOf,
    isAlive,
    leaseTaken,
    outerOf,
    pidOf,
    realOf,
} from '../../../lint/kit/project/leases.js';

/** The file a running gate holds its checkout with, from the project's root: the pid of the gate, alone. */
export const GATE_LOCK = `${ARTIFACTS}/gate.lock`;

const readOf = (file: string): string | undefined =>
    existsSync(file) ? String(readFileSync(file)) : undefined;

/** The live process holding the checkout, or `undefined` where none does: a lock whose holder died holds nothing. */
export function holderOf(project: string): number | undefined {
    const pid = pidOf(readOf(join(project, GATE_LOCK)));

    return isAlive(pid) ? pid : undefined;
}

/** A gate holding the checkout that this process is no step of. */
export function foreignHolderOf(project: string): number | undefined {
    const holder = holderOf(project);

    return holder === gateOf(project) ? undefined : holder;
}

/** Runs `run` as a gate holding `project`: the lock taken where no live gate holds it (a lock whose holder died is taken over), and dropped at the end by the process that took it; a gate already holding it leaves its hold as it is. The gate leases its share of the machine while it runs; a gate nested in another checkout's, such as a spec's run in a fixture, leases nothing, since it runs inside its outer gate's share. */
export async function withGateLock<T>(project: string, run: () => Promise<T>): Promise<T> {
    const outer = outerOf(process.env);
    const gate = gateOf(project);
    const lock = join(project, GATE_LOCK);
    const held = holderOf(project) !== undefined;
    if (!held) {
        mkdirSync(dirname(lock), { recursive: true });
        writeFileSync(lock, `${String(gate)}\n`);
    }
    const leased =
        outer === undefined || outer.pid === gate ? leaseTaken(gate, realOf(project)) : undefined;
    try {
        return await withEnvironment(
            { [GATE_VARIABLE]: `${String(gate)}:${realOf(project)}` },
            run,
        );
    } finally {
        if (gate === process.pid && leased !== undefined) {
            rmSync(leased);
        }
        if (gate === process.pid && !held && pidOf(readOf(lock)) === gate) {
            rmSync(lock);
        }
    }
}

/** The four parts a gesture that replaces what a gate reads refuses with while another gate holds the checkout, or `undefined` where none does. */
export function refusedWhileGated(project: string, gesture: string): string | undefined {
    const holder = foreignHolderOf(project);

    return holder === undefined
        ? undefined
        : refusal({
              fix: `wait for pid ${String(holder)} to end, or run ${gesture} in a worktree of its own`,
              found: `the gate of pid ${String(holder)} holds this checkout (${GATE_LOCK})`,
              read: 'docs/reference/quality-checks.md#one-gate-per-checkout',
              why: `${gesture} replaces what a running gate reads (its build, its install), and the gate would judge a tree that changed under it`,
          });
}
