import { spawnSync } from 'node:child_process';

const KILOBYTE = 1024;

/** The resident memory of every process below `pid` in a `ps -A -o pid=,ppid=,rss=` table, in bytes; `pid` itself is left out. */
export function residentBelow(table: string, pid: number): number {
    const rows = table
        .split('\n')
        .map((line) => line.trim().split(/\s+/u).map(Number))
        .filter((row) => row.length === 3 && row.every(Number.isInteger));
    const below = new Set([pid]);
    let total = 0;
    let grown = true;
    while (grown) {
        grown = false;
        for (const [child, parent, resident] of rows) {
            if (below.has(Number(parent)) && !below.has(Number(child))) {
                below.add(Number(child));
                total += Number(resident) * KILOBYTE;
                grown = true;
            }
        }
    }

    return total;
}

const residentNow = (pid: number): number | undefined => {
    const listed = spawnSync('ps', ['-A', '-o', 'pid=,ppid=,rss='], { encoding: 'utf8' });

    // Stryker disable next-line ConditionalExpression: a ps that fails prints no row, so its table reads as nothing held, and a peak of nothing teaches no price
    return listed.status === 0 ? residentBelow(listed.stdout, pid) : undefined;
};

/** The most resident memory the processes below a pid held at once so far, and the gesture that stops watching and says it; `undefined` before `ps` read anything. */
export type Watch = { read: () => number | undefined; stop: () => number | undefined };

/** Watches the processes below `pid`, sampled every `everyMs`, until stopped. */
export function residentPeak(pid: number, everyMs: number): Watch {
    let peak: number | undefined;
    const sampled = (): void => {
        const now = residentNow(pid);
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
