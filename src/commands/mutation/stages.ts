import { reportWithUnmeasured } from '../../../lint/kit/project/browser-side.js';
import { readManifest } from '../../../lint/kit/project/manifest.js';
import type { Measured, StageOutcome } from '../../drivers/stryker/stryker.js';

export const buildsOf = (project: string): boolean =>
    readManifest(project)?.scripts?.build !== undefined;

export const NOTHING_MEASURED: Measured = { ranByTests: new Set(), report: undefined };

// invariant: a stage that measured nothing says nothing next; a failed one says Stryker's status.
export async function afterStage(
    outcome: StageOutcome | undefined,
    next: (measured: Measured) => number | Promise<number>,
): Promise<number> {
    if (outcome !== undefined && 'status' in outcome) {
        return outcome.status;
    }

    return await next(outcome ?? NOTHING_MEASURED);
}

// invariant: a `client:only` component is loaded by the server and rendered by none, so what no test judged there is unmeasured, never a survivor; a failed stage has no report to read.
export const withClientOnlyUnmeasured = (
    outcome: StageOutcome,
    sources: ReadonlySet<string>,
): StageOutcome => reportMapped(outcome, (report) => reportWithUnmeasured(report, sources));

/** A stage's outcome with its report as `map` reads it; a failed stage has no report and is handed on as it is. */
export const reportMapped = (
    outcome: StageOutcome,
    map: (report: unknown) => unknown,
): StageOutcome => ('report' in outcome ? { ...outcome, report: map(outcome.report) } : outcome);
