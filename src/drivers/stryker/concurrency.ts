import type { Resources } from '../../../lint/kit/project/capacity.js';

/** How a stage runs on its slice: Stryker's concurrency, the checkers it holds while checking, and which resource bound the count. */
export type Runners = { binds: 'cpus' | 'memory'; checkers: number; runners: number };

// outside: Stryker 10 takes one concurrency and, with a checker, starts `ceil(c/2)` checkers and `floor(c/2)` runners, then turns the checkers into runners when checking ends (core/dist/src/concurrent/concurrency-token-provider.js); no option sets the checkers apart, so each of its two phases is priced apart.
const fits = (count: number, memory: number, { checker, runner }: Prices): boolean =>
    count * runner <= memory &&
    (checker === undefined ||
        Math.ceil(count / 2) * checker + Math.floor(count / 2) * runner <= memory);

/** The prices a stage is sized by: a test runner's, and a checker's where the project is type-checked. */
export type Prices = { checker: number | undefined; runner: number };

/** The most test runners a slice holds: as many as its cpus, fewer where its memory binds, checking or running, never none. */
export function runnersOf({ cpus, memory }: Resources, prices: Prices): Runners {
    let runners = cpus;
    while (runners > 1 && !fits(runners, memory, prices)) {
        runners -= 1;
    }

    return {
        binds: runners < cpus ? 'memory' : 'cpus',
        checkers: prices.checker === undefined ? 0 : Math.ceil(runners / 2),
        runners,
    };
}

const MB = 1024 ** 2;

/** The slice one test runner hands what its tests spawn: its share of the stage's cpus, and of the memory the stage's runners leave at `price` each, never none. */
export const runnerSlice = (
    { cpus, memory }: Resources,
    runners: number,
    price: number,
): Resources => ({
    cpus: Math.max(1, Math.floor(cpus / runners)),
    memory: Math.max(MB, Math.floor(memory / runners - price)),
});
