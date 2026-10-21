import type { Pool } from './capacity.js';

/** The two runs of a mutation command. */
export type StageName = 'modules' | 'suite';

/** What one stage is, read once: the files it writes under the mutation output, the pool it is priced as, what it measures as a reader is told, and how long Stryker waits on it. */
export type StageSpec = {
    config: string;
    incremental: string;
    measuring: string;
    pool: Extract<Pool, `stryker-${string}`>;
    report: string;
    sandbox: string;
    subject: string;
    timeouts: { dryRunMinutes?: number; mutantMs: number };
    vitest: string;
};

export const STAGES: Readonly<Record<StageName, StageSpec>> = {
    modules: {
        config: 'stryker.config.json',
        incremental: 'incremental',
        measuring: 'Measuring the module tests against mutants of the sources they test',
        pool: 'stryker-modules',
        report: 'report',
        sandbox: 'sandbox.mjs',
        subject: 'module tests',
        timeouts: { mutantMs: 30_000 },
        vitest: 'vitest.config.mjs',
    },
    suite: {
        config: 'stryker.suite.config.json',
        incremental: 'suite-incremental',
        measuring:
            'Measuring the whole suite against what the module tests let live, and the changed lines they do not run',
        pool: 'stryker-suite',
        report: 'suite-report',
        sandbox: 'sandbox.suite.mjs',
        subject: 'whole suite',
        timeouts: { dryRunMinutes: 60, mutantMs: 60_000 },
        vitest: 'vitest.suite.config.mjs',
    },
};
