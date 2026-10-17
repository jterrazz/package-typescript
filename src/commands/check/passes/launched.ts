export type Timed = { seconds: Promise<number>; status: Promise<number> };

export type Launched = Timed & { log: string };

export const secondsSince = (from: number): number =>
    Math.round((performance.now() - from) / 100) / 10;

async function secondsTo(status: Promise<number>, from: number): Promise<number> {
    await Promise.allSettled([status]);

    return secondsSince(from);
}

/** A run timed from `from` — its launch, by default — to its verdict, whether it resolves or rejects. */
export const timed = (status: Promise<number>, from = performance.now()): Timed => ({
    seconds: secondsTo(status, from),
    status,
});

/** A pass launched now, its log beside its timed verdict. */
export const launched = (log: string, status: Promise<number>): Launched => ({
    log,
    ...timed(status),
});

/** The seconds of two runs one after the other, to the tenth. */
export const secondsAdded = (first: number, second: number): number =>
    Math.round((first + second) * 10) / 10;

/** Runs in parallel end when the slowest of them does; none took no time. */
export const slowestOf = (runs: readonly { seconds: number }[]): number =>
    Math.max(0, ...runs.map(({ seconds }) => seconds));
