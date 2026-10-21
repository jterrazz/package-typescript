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

function below(rows: readonly Row[], pid: number, apart: ReadonlySet<number>): number {
    const reached = new Set([pid]);
    let total = 0;
    let grown = true;
    while (grown) {
        grown = false;
        for (const { child, parent, resident } of rows) {
            if (reached.has(parent) && !reached.has(child) && !apart.has(child)) {
                reached.add(child);
                total += resident;
                grown = true;
            }
        }
    }

    return total;
}

/** The resident memory of what the tools `pid` started started in turn, read from a `ps -A -o pid=,ppid=,rss=` table, in bytes: the processes below each child of `pid`, each child itself left out, and every process at or below a pid of `apart`. */
export function residentBelowTools(
    table: string,
    pid: number,
    apart: ReadonlySet<number> = new Set(),
): number {
    const rows = rowsOf(table);

    return rows
        .filter(({ child, parent }) => parent === pid && !apart.has(child))
        .reduce((total, { child }) => total + below(rows, child, apart), 0);
}

const residentNow = (pid: number, apart: ReadonlySet<number>): number | undefined => {
    const listed = spawnSync('ps', ['-A', '-o', 'pid=,ppid=,rss='], { encoding: 'utf8' });

    // Stryker disable next-line ConditionalExpression: a ps that fails prints no row, so its table reads as nothing held, and a peak of nothing teaches no price
    return listed.status === 0 ? residentBelowTools(listed.stdout, pid, apart) : undefined;
};

/** The most resident memory the processes below a pid's tools held at once so far, and the gesture that stops watching and says it; `undefined` before `ps` read anything. */
export type Watch = { read: () => number | undefined; stop: () => number | undefined };

/** Watches what the tools `pid` started started in turn, sampled every `everyMs` until stopped, leaving out each sample the processes `apart` names then. */
export function residentPeak(
    pid: number,
    everyMs: number,
    apart: () => ReadonlySet<number> = () => new Set(),
): Watch {
    let peak: number | undefined;
    const sampled = (): void => {
        const now = residentNow(pid, apart());
        if (now !== undefined) {
            peak = Math.max(peak ?? 0, now);
        }
    };
    const timer = setInterval(sampled, everyMs);

    return {
        read: () => peak,
        stop: () => {
            clearInterval(timer);

            return peak;
        },
    };
}
