import { spawnSync } from 'node:child_process';

const KILOBYTE = 1024;

type Row = { child: number; parent: number; resident: number };

const rowsOf = (table: string): Row[] =>
    table
        .split('\n')
        .map((line) => line.trim().split(/\s+/u).map(Number))
        .filter((row) => row.length === 3 && row.every(Number.isInteger))
        .map(([child, parent, resident]) => ({
            child: Number(child),
            parent: Number(parent),
            resident: Number(resident) * KILOBYTE,
        }));

/** What the processes below a pid held at one sample, in bytes: its tools, down to the depth the watch names, each held once whatever count of workers it serves, and the workers below them. */
export type Resident = { below: number; tools: number };

/** The resident memory below `pid`, read from a `ps -A -o pid=,ppid=,rss=` table: the processes down to `depth` below it are its tools, every one deeper is below them, and each process at or below a pid of `apart` is left out. */
export function residentOf(
    table: string,
    pid: number,
    { apart = new Set(), depth = 1 }: { apart?: ReadonlySet<number>; depth?: number } = {},
): Resident {
    const rows = rowsOf(table);
    const held: Resident = { below: 0, tools: 0 };
    let level = new Set([pid]);
    for (let reached = 1; level.size > 0; reached += 1) {
        const next = new Set<number>();
        for (const { child, parent, resident } of rows) {
            if (level.has(parent) && !apart.has(child)) {
                next.add(child);
                held[reached <= depth ? 'tools' : 'below'] += resident;
            }
        }
        level = next;
    }

    return held;
}

const residentNow = (
    pid: number,
    options: { apart: ReadonlySet<number>; depth: number },
): Resident | undefined => {
    const listed = spawnSync('ps', ['-A', '-o', 'pid=,ppid=,rss='], { encoding: 'utf8' });

    // Stryker disable next-line ConditionalExpression: a ps that fails prints no row, so its table reads as nothing held, and a sample of nothing teaches no price
    return listed.status === 0 ? residentOf(listed.stdout, pid, options) : undefined;
};

/** The samples a watch took so far, and the gesture that stops watching and hands them all. */
export type Watch = { read: () => readonly Resident[]; stop: () => readonly Resident[] };

/** Watches what a pid's tools held and what they started, sampled every `everyMs` until stopped: the processes down to `depth` below it are its tools, and each sample leaves out the processes `apart` names then. */
export function residentWatch(
    pid: number,
    everyMs: number,
    {
        apart = () => new Set(),
        depth = 1,
    }: { apart?: () => ReadonlySet<number>; depth?: number } = {},
): Watch {
    const samples: Resident[] = [];
    const sampled = (): void => {
        const now = residentNow(pid, { apart: apart(), depth });
        if (now !== undefined) {
            samples.push(now);
        }
    };
    const timer = setInterval(sampled, everyMs);

    return {
        read: () => [...samples],
        stop: () => {
            clearInterval(timer);

            return [...samples];
        },
    };
}
