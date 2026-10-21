import { secondsSince } from '../../timing.js';

export type Launched = { log: string; status: Promise<number> };

export type Timed = { seconds: Promise<number>; status: Promise<number> };

export type TimedLaunch = Launched & Timed;

async function secondsTo(status: Promise<number>, from: number): Promise<number> {
    await Promise.allSettled([status]);

    return secondsSince(from);
}

/** A run timed from `from` (its launch, by default) to its verdict, whether it resolves or rejects. */
export const timed = (status: Promise<number>, from = performance.now()): Timed => ({
    seconds: secondsTo(status, from),
    status,
});

/** A pass launched now, its log beside its timed verdict. */
export const launched = (log: string, status: Promise<number>): TimedLaunch => ({
    log,
    ...timed(status),
});

/** A pass that was launched, timed from now, or from `from`, to its verdict; a pass that did not apply stays absent. */
export const timedLaunch = <T extends Launched>(
    pass: T | undefined,
    from = performance.now(),
): (T & Timed) | undefined =>
    pass === undefined ? undefined : { ...pass, ...timed(pass.status, from) };

/** Every run of a list, each timed from `from` to its verdict. */
export const timedLaunches = <T extends Launched>(
    passes: readonly T[],
    from = performance.now(),
): (T & Timed)[] => passes.map((pass) => ({ ...pass, ...timed(pass.status, from) }));

/** The seconds of two runs one after the other, to the tenth. */
export const secondsAdded = (first: number, second: number): number =>
    Math.round((first + second) * 10) / 10;

/** Runs in parallel end when the slowest of them does; none took no time. */
export const slowestOf = (runs: readonly { seconds: number }[]): number =>
    Math.max(0, ...runs.map(({ seconds }) => seconds));
