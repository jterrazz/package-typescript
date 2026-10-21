import { mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

import { objectOf, parsedObject } from './json.js';

/** Whether a process lives: one this user may not signal lives all the same; no pid, or one that is no whole number, names none. */
export function isAlive(pid: number | undefined): pid is number {
    try {
        process.kill(Number(pid), 0);

        return true;
    } catch (error) {
        return objectOf(error).code === 'EPERM';
    }
}

/** Every outermost gate of this machine leases its share here while it runs, one file per gate named for its pid. */
export const leaseFolder = (): string => join(tmpdir(), 'typescript-capacity');

/** A gate's lease: its pid, the checkout it gates, and when it took the lease. */
export type Lease = { pid: number; root: string; since: number };

function leaseIn(folder: string, name: string): Lease | undefined {
    const pid = Number(name);
    if (!isAlive(pid)) {
        // Stryker disable next-line ObjectLiteral,BooleanLiteral: the entry was just listed; forcing only spares a race with another gate pruning it at the same moment
        rmSync(join(folder, name), { force: true });

        return undefined;
    }
    let lease;
    try {
        const text = String(readFileSync(join(folder, name)));
        lease = parsedObject(text);
    } catch {
        lease = {};
    }

    return { pid, root: String(lease.root), since: Number(lease.since) || 0 };
}

/** Orders leases oldest first, two of one age by pid, so every gate ranks them alike. */
export const byAge = (a: Lease, b: Lease): number => a.since - b.since || a.pid - b.pid;

/** The leases of the gates living on this machine, oldest first; a lease whose gate died is taken away. */
export function liveLeases(folder: string = leaseFolder()): Lease[] {
    let names: string[];
    try {
        names = readdirSync(folder);
    } catch {
        return [];
    }

    return names
        .map((name) => leaseIn(folder, name))
        .filter((lease) => lease !== undefined)
        .toSorted(byAge);
}

/** Takes a lease for the gate of `pid` on `root`, as of now. */
export function leaseTaken(pid: number, root: string, folder: string = leaseFolder()): string {
    const file = join(folder, String(pid));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify({ root, since: Date.now() })}\n`);

    return file;
}

/** Names the gate a process runs inside, `<pid>:<root>`, so the steps of one `make check` are one gate holding its root and the builds a gate runs are never refused. */
export const GATE_VARIABLE = 'TYPESCRIPT_GATE';

/** The pid a text names, or none where it names no positive number. */
export const pidOf = (text: string | undefined): number | undefined => {
    const pid = Number(text);

    return pid > 0 ? pid : undefined;
};

/** The gate a process runs inside: its pid and the checkout it gates. */
export type Outer = { pid: number; root: string };

/** A path as the leases compare it: resolved through its links where it stands, else made absolute. */
export const realOf = (path: string): string => {
    try {
        return realpathSync(path);
    } catch {
        return resolve(path);
    }
};

/** The live gate `TYPESCRIPT_GATE` names, or none. */
// invariant: a value with no colon names a root made of digits alone, which no checkout is, so it is adopted by none.
export function outerOf(environment: NodeJS.ProcessEnv): Outer | undefined {
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
