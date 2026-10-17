import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { ARTIFACTS } from '../../../lint/kit/project/build-plan.js';
import { objectOf } from '../../../lint/kit/project/json.js';

/** The file a running gate holds its checkout with, from the project's root: the pid of the gate, alone. */
export const GATE_LOCK = `${ARTIFACTS}/gate.lock`;

/** Names the gate a process runs inside, `<pid>:<root>`, so the steps of one `make check` are one gate holding its root and the builds a gate runs are never refused. */
export const GATE_VARIABLE = 'TYPESCRIPT_GATE';

const pidOf = (text: string | undefined): number | undefined => {
    const pid = Number(text);

    return pid > 0 ? pid : undefined;
};

/** Whether a process lives: one this user may not signal lives all the same; no pid, or one that is no whole number, names none. */
export function isAlive(pid: number | undefined): pid is number {
    try {
        process.kill(Number(pid), 0);

        return true;
    } catch (error) {
        return objectOf(error).code === 'EPERM';
    }
}

const readOf = (file: string): string | undefined =>
    existsSync(file) ? String(readFileSync(file)) : undefined;

/** The live process holding the checkout, or `undefined` where none does: a lock whose holder died holds nothing. */
export function holderOf(project: string): number | undefined {
    const pid = pidOf(readOf(join(project, GATE_LOCK)));

    return isAlive(pid) ? pid : undefined;
}

type Outer = { pid: number; root: string };

const realOf = (path: string): string => {
    try {
        return realpathSync(path);
    } catch {
        return resolve(path);
    }
};

// invariant: a value with no colon names a root made of digits alone, which no checkout is, so it is adopted by none.
function outerOf(environment: NodeJS.ProcessEnv): Outer | undefined {
    const named = String(environment[GATE_VARIABLE]);
    const colon = named.indexOf(':');
    const pid = pidOf(named.slice(0, colon));

    return isAlive(pid) ? { pid, root: realOf(named.slice(colon + 1)) } : undefined;
}

/** The gate this process is a step of in `project`: the one its caller names for that same checkout, else this process. */
export function gateOf(project: string, environment: NodeJS.ProcessEnv = process.env): number {
    const outer = outerOf(environment);

    return outer !== undefined && outer.root === realOf(project) ? outer.pid : process.pid;
}

/** A gate holding the checkout that this process is no step of. */
export function foreignHolderOf(project: string): number | undefined {
    const holder = holderOf(project);

    return holder === gateOf(project) ? undefined : holder;
}

/** Every live gate of this machine registers here, so a run sizes its share of the cores by how many run beside it. */
export const gatesFolder = (): string => join(tmpdir(), 'typescript-gates');

/** How many gates live on this machine, this one included; a registration whose gate died is taken away. */
export function activeGates(): number {
    const folder = gatesFolder();
    let names: string[];
    try {
        names = readdirSync(folder);
    } catch {
        return 1;
    }
    const live = names.filter((name) => {
        if (isAlive(pidOf(name))) {
            return true;
        }
        // Stryker disable next-line ObjectLiteral,BooleanLiteral: the entry was just listed; forcing only spares a race with another gate pruning it at the same moment
        rmSync(join(folder, name), { force: true });

        return false;
    });

    return Math.max(1, live.length);
}

/** Runs `run` as a gate holding `project`: the lock taken where no live gate holds it (a lock whose holder died is taken over), and dropped at the end by the process that took it; a gate already holding it leaves its hold as it is. A gate nested in another checkout's, such as a spec's run in a fixture, registers nothing more on the machine. */
export async function withGateLock<T>(project: string, run: () => Promise<T>): Promise<T> {
    const outer = outerOf(process.env);
    const gate = gateOf(project);
    const lock = join(project, GATE_LOCK);
    const held = holderOf(project) !== undefined;
    if (!held) {
        mkdirSync(dirname(lock), { recursive: true });
        writeFileSync(lock, `${String(gate)}\n`);
    }
    const registered =
        outer === undefined || outer.pid === gate ? join(gatesFolder(), String(gate)) : undefined;
    if (registered !== undefined) {
        mkdirSync(gatesFolder(), { recursive: true });
        writeFileSync(registered, realOf(project));
    }
    const before = process.env[GATE_VARIABLE];
    process.env[GATE_VARIABLE] = `${String(gate)}:${realOf(project)}`;
    try {
        return await run();
    } finally {
        restored(before);
        if (gate === process.pid && registered !== undefined) {
            rmSync(registered);
        }
        if (gate === process.pid && !held && pidOf(readOf(lock)) === gate) {
            rmSync(lock);
        }
    }
}

function restored(before: string | undefined): void {
    if (before === undefined) {
        Reflect.deleteProperty(process.env, GATE_VARIABLE);
    } else {
        process.env[GATE_VARIABLE] = before;
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
