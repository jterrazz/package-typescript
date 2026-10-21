import { STAGES } from '../../../../lint/kit/project/mutation-stages.js';
import { mutatedLines } from '../../../drivers/stryker/mutate-entries.js';
import { strykerRun } from '../../../drivers/stryker/stryker.js';
import type { Stage, StageOutcome } from '../../../drivers/stryker/stryker.js';
import { incrementalKeptWhileInputsHold, recordInputs } from './incremental.js';
import type { LinesInFunctions, StaysInFunctions } from './incremental.js';
import { observedFrom } from './observed.js';

/** What the suite's dry run runs before its first mutant: the test files it keeps of those the record knows, `undefined` for every one, on how many workers. */
export type DryRunScope = {
    files: undefined | { kept: number; known: number };
    workers: number;
};

/** How a stage runs on its record: whether the sandbox builds first, from no report, on how many test runners, in which project, how a change and a mutated line are read, and who hears what the suite's dry run runs. */
export type RecordedRun = {
    buildsFirst: boolean;
    cold: boolean;
    concurrency: number;
    dryRunScoped: (scope: DryRunScope) => void;
    linesInFunctions: LinesInFunctions;
    project: string;
    staysInFunctions: StaysInFunctions;
};

/** Runs a stage on what its record keeps: the incremental report cut to what the change leaves standing, a suite's dry run limited to the test files the change reaches, and, once the stage ends, what its tests ran written back. */
export async function recordedStageRun(
    scope: { readonly exclude: readonly string[]; readonly mutated: readonly string[] },
    stage: Stage,
    run: RecordedRun,
): Promise<StageOutcome> {
    const { incremental } = STAGES[stage.name];
    const suite = stage.name === 'suite';
    const { carried, dryRun, inputs } = incrementalKeptWhileInputsHold(run.project, incremental, {
        cold: run.cold,
        dryRunOver: suite
            ? { lines: mutatedLines(stage.mutate), linesInFunctions: run.linesInFunctions }
            : undefined,
        staysInFunctions: run.staysInFunctions,
    });
    if (suite) {
        run.dryRunScoped({
            files: dryRun && { kept: dryRun.kept.length, known: dryRun.known },
            workers: run.concurrency,
        });
    }
    const ran = await strykerRun(scope, stage, {
        buildsFirst: run.buildsFirst,
        concurrency: run.concurrency,
        project: run.project,
        testFiles: dryRun?.kept,
    });
    if ('status' in ran) {
        return ran;
    }
    // invariant: a test file the dry run left out holds no test the change made stale, so what the last record says of its tests still holds and is carried into this one.
    const observed = observedFrom([...ran.observed, ...carried], inputs);
    recordInputs(run.project, incremental, { inputs: inputs ?? {}, observed });

    return { ranByTests: ran.ranByTests, report: ran.report };
}
