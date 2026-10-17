import { mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { ARTIFACTS } from '../../../lint/kit/project/build-plan.js';

/** The file a running gate holds its checkout with, from the project's root: the pid of the gate, alone. */
export const GATE_LOCK = `${ARTIFACTS}/gate.lock`;

/** Names the gate a process runs inside, `<pid>:<root>`, so the steps of one `make check` are one gate holding its root and the builds a gate runs are never refused. */
export const GATE_VARIABLE = 'TYPESCRIPT_GATE';

const pidOf = (text: string | undefined): number | undefined => {
    const pid = Number(text?.trim());

    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
};

/** Whether a process lives: one this user may not signal lives all the same. */
export function isAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);

        return true;
    } catch (error) {
        return error instanceof Error && 'code' in error && error.code === 'EPERM';
    }
}

function readOf(file: string): string | undefined {
    try {
        return readFileSync(file, 'utf8');
    } catch {
        return undefined;
    }
}

/** The live process holding the checkout, or `undefined` where none does — a lock whose holder died holds nothing. */
export function holderOf(project: string): number | undefined {
    const pid = pidOf(readOf(join(project, GATE_LOCK)));

    return pid !== undefined && isAlive(pid) ? pid : undefined;
}

type Outer = { pid: number; root: string };

const realOf = (path: string): string => {
    try {
        return realpathSync(path);
    } catch {
        return resolve(path);
    }
};

function outerOf(environment: NodeJS.ProcessEnv): Outer | undefined {
    const named = environment[GATE_VARIABLE] ?? '';
    const colon = named.indexOf(':');
    const pid = pidOf(named.slice(0, colon));

    return colon > 0 && pid !== undefined && isAlive(pid)
        ? { pid, root: realOf(named.slice(colon + 1)) }
        : undefined;
}

/** The gate this process is a step of in `project`: the one its caller names for that same checkout, else this process. */
export function gateOf(project: string, environment: NodeJS.ProcessEnv = process.env): number {
    const outer = outerOf(environment);

    return outer !== undefined && outer.root === realOf(project) ? outer.pid : process.pid;
}

/** A gate holding the checkout that this process is no step of. */
export function foreignHolderOf(project: string): number | undefined {
    const holder = holderOf(project);

    return holder === undefined || holder === gateOf(project) ? undefined : holder;
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
        const pid = pidOf(name);
        if (pid !== undefined && isAlive(pid)) {
            return true;
        }
        rmSync(join(folder, name), { force: true });

        return false;
    });

    return Math.max(1, live.length);
}

/** Runs `run` as a gate holding `project`: the lock taken where no live gate holds it — a lock whose holder died is taken over —, and dropped at the end by the process that took it; a gate already holding it leaves its hold as it is. A gate nested in another checkout's — a spec's run in a fixture — registers nothing more on the machine. */
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
        writeFileSync(registered, `${realOf(project)}\n`);
    }
    const before = process.env[GATE_VARIABLE];
    process.env[GATE_VARIABLE] = `${String(gate)}:${realOf(project)}`;
    try {
        return await run();
    } finally {
        restored(before);
        if (gate === process.pid && registered !== undefined) {
            rmSync(registered, { force: true });
        }
        if (gate === process.pid && !held && pidOf(readOf(lock)) === gate) {
            rmSync(lock, { force: true });
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
              why: `${gesture} replaces what a running gate reads — its build, its install — and the gate would judge a tree that changed under it`,
          });
}
