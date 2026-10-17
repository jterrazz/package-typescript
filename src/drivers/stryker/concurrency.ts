import type { StageName } from './reports.js';

/** What `TYPESCRIPT_JOBS` names: nothing when unset or blank, else the count it writes — `NaN` for anything but a positive integer. */
export function jobsNamed(value: string | undefined): number | undefined {
    if (value === undefined || value.trim() === '') {
        return undefined;
    }
    const jobs = Number(value.trim());

    return Number.isInteger(jobs) && jobs > 0 ? jobs : Number.NaN;
}

/** The test runners a stage hands Stryker: the count named, else this gate's share of the machine's cores among the gates running on it, the whole suite three quarters of that share — its specs spawn processes of their own. */
export function concurrencyOf(
    stage: StageName,
    { cores, gates, jobs }: { cores: number; gates: number; jobs: number | undefined },
): number {
    if (jobs !== undefined) {
        return jobs;
    }
    const share = Math.max(1, Math.floor(cores / Math.max(1, gates)));

    return stage === 'suite' ? Math.max(1, Math.floor((share * 3) / 4)) : share;
}
