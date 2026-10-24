import { availableParallelism, totalmem } from 'node:os';
import process from 'node:process';

import { refusal } from '../catalogue/lesson.js';
import type { Lesson } from '../catalogue/lesson.js';
import type { Lease } from './leases.js';

/** The variable that gives a gate its capacity, `cpus=<count>,memory=<size>`: a person's override, or the slice a gate hands the gates its workers run. */
export const CAPACITY_VARIABLE = 'TYPESCRIPT_CAPACITY';

/** The pools a capacity is shared out to: a Vitest worker, a Stryker test runner of each stage with every process its tests spawn, a TypeScript checker. */
export type Pool = 'checker' | 'stryker-modules' | 'stryker-suite' | 'vitest';

const MB = 1024 ** 2;

const GB = 1024 ** 3;

/** What one worker of each pool is priced at until a run measures one. */
export const SEED_PRICES: Readonly<Record<Pool, number>> = {
    checker: 720 * MB,
    'stryker-modules': 650 * MB,
    'stryker-suite': GB,
    vitest: 600 * MB,
};

/** What the tool that runs each pool's workers holds once, whatever count of workers it runs, until a run measures it: Stryker's own process, Vitest's with the npm that starts it; a checker is run by Stryker's. */
export const SEED_TOOLS: Readonly<Record<Pool, number>> = {
    checker: 0,
    'stryker-modules': 300 * MB,
    'stryker-suite': 300 * MB,
    vitest: 300 * MB,
};

/** What a pool costs: its tool, held once, and each of its workers. */
export type Cost = { tool: number; worker: number };

export type Resources = { cpus: number; memory: number };

/** A machine as a gate reads it: its cpus and memory, the memory nothing holds now, and whether a variable gave them. */
export type Machine = Resources & { available: number; given: boolean };

/** What a gate may use: its cpus and memory, among how many gates. */
export type Slice = Resources & { gates: number };

const UNITS: Readonly<Record<string, number>> = { g: GB, k: 1024, m: MB };

function partOf(part: string): Partial<Resources> | undefined {
    const [key, written] = part.split('=').map((side) => side.trim());
    const value = String(written);
    const size = /^(?<amount>\d+(?:\.\d+)?)(?<unit>[gkm])$/iu.exec(value)?.groups;
    const amount = Number(size?.amount);
    if (key === 'cpus' && /^\d+$/u.test(value) && Number(value) > 0) {
        return { cpus: Number(value) };
    }
    if (key === 'memory' && amount > 0) {
        const unit = Number(UNITS[String(size?.unit).toLowerCase()]);

        return { memory: Math.floor(amount * unit) };
    }

    return undefined;
}

/** What `TYPESCRIPT_CAPACITY` names: nothing when unset or blank, else the cpus and memory it writes, `unreadable` for anything but `cpus=<count>`, `memory=<size>` (`k`, `m` or `g`) or both, comma-separated. */
export function capacityNamed(
    value: string | undefined,
): 'unreadable' | Partial<Resources> | undefined {
    if (value === undefined || value.trim() === '') {
        return undefined;
    }
    const parts = value.split(',').map(partOf);
    const named: Partial<Resources> = {};
    for (const part of parts) {
        Object.assign(named, part);
    }

    return parts.includes(undefined) || parts.length !== Object.keys(named).length
        ? 'unreadable'
        : named;
}

/** A capacity written as `TYPESCRIPT_CAPACITY` reads it, its memory in whole megabytes. */
export const capacityValue = ({ cpus, memory }: Resources): string =>
    `cpus=${String(cpus)},memory=${String(Math.floor(memory / MB))}m`;

/** What a `TYPESCRIPT_CAPACITY` that names no capacity teaches, and where to read. */
export const capacityUnread = (named: string): Lesson => ({
    fix: "write it cpus=<count>,memory=<size> (cpus=4,memory=8g), either part alone, or leave it unset to take this gate's share of the machine",
    found: `${CAPACITY_VARIABLE} is ${named}, which names no capacity`,
    read: 'docs/reference/quality-checks.md#how-many-test-runners',
    why: 'a capacity read wrong would size every pool of the gate from a machine that is not there',
});

/** The capacity `TYPESCRIPT_CAPACITY` names in `environment`, or none where it is unset or blank; a value that names no capacity is refused. */
export function capacityGiven(environment: NodeJS.ProcessEnv): Partial<Resources> | undefined {
    const written = environment[CAPACITY_VARIABLE];
    const named = capacityNamed(written);
    if (named === 'unreadable') {
        const unread = capacityUnread(String(written));
        throw new Error(refusal(unread));
    }

    return named;
}

const constrained = (): number => {
    const limit = process.constrainedMemory();

    // Stryker disable next-line ConditionalExpression: a host with no container limit reports none, so no module test runs where a limit binds; the rehearsal's container reads one
    return limit > 0 ? limit : Number.POSITIVE_INFINITY;
};

/** The machine a gate runs on: the capacity `TYPESCRIPT_CAPACITY` gave it, else the cpus Node counts (a container's quota included), the least of the memory installed and a container's limit, and the memory nothing holds now, as the system counts it. */
export function machineOf(named: Partial<Resources> | undefined): Machine {
    const memory = named?.memory ?? Math.min(totalmem(), constrained());

    return {
        available: named?.memory ?? Math.min(memory, process.availableMemory()),
        cpus: named?.cpus ?? availableParallelism(),
        given: named !== undefined,
        memory,
    };
}

/** How many workers of a pool a slice holds: its cpus, or fewer where the memory its tool leaves binds, never none. */
export const slots = ({ cpus, memory }: Resources, { tool, worker }: Cost): number =>
    Math.max(1, Math.min(cpus, Math.floor((memory - tool) / worker)));

// value: an eighth of the machine stays for everything that is no gate, and for a price measured short.
const budgetOf = ({ available, memory }: Machine): number =>
    Math.max(0, Math.floor(available - memory / 8));

/** The share of a machine one gate may use: all of a capacity a variable gave it; else its rank's share of the cpus among the live leases (the oldest takes a remainder first, so the shares add up to the machine), and as much of the memory, bounded by what the machine leaves free now. A gate that holds no lease counts as the newest. */
export function sliceOf(machine: Machine, leases: readonly Lease[], gate?: number): Slice {
    const budget = budgetOf(machine);
    if (machine.given) {
        return { cpus: machine.cpus, gates: 1, memory: budget };
    }
    const held = leases.findIndex((lease) => lease.pid === gate);
    const gates = held === -1 ? leases.length + 1 : leases.length;
    const remainder = held !== -1 && held < machine.cpus % gates ? 1 : 0;
    const cpus = Math.max(1, Math.floor(machine.cpus / gates) + remainder);
    const share = Math.floor(((machine.memory * 7) / 8) * (cpus / machine.cpus));

    return { cpus, gates, memory: Math.min(budget, share) };
}

const gigabytes = (bytes: number): string => `${(bytes / GB).toFixed(1)} GB`;

/** The line a gate prints for what it leased: the machine as read or given, then this gate's slice. */
export function capacityLine(machine: Machine, slice: Slice): string {
    const read = machine.given
        ? `given by ${CAPACITY_VARIABLE}`
        : `${gigabytes(machine.available)} available, ${String(slice.gates)} gate(s)`;

    return `capacity: ${String(machine.cpus)} cpus, ${gigabytes(machine.memory)}, ${read}: this gate ${String(slice.cpus)} cpus, ${gigabytes(slice.memory)}`;
}

/** A price as the capacity line prints it, in whole megabytes. */
export const priceText = (bytes: number): string => `${String(Math.round(bytes / MB))} MB`;
