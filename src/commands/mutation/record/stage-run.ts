import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { MUTATION_OUTPUT } from '../../../../lint/kit/project/build-plan.js';
import { STAGES } from '../../../../lint/kit/project/mutation-stages.js';
import { mutantsInstrumented } from '../../../drivers/stryker/enumerate.js';
import {
    heldReport,
    mutatedLines,
    mutateEntryOf,
} from '../../../drivers/stryker/mutate-entries.js';
import type { ObservedTest } from '../../../drivers/stryker/record-folders.js';
import { IGNORERS_FILE, strykerRun } from '../../../drivers/stryker/stryker.js';
import type { Stage, StageOutcome } from '../../../drivers/stryker/stryker.js';
import { carriedOf } from './carried.js';
import type { CarriedCompileError } from './carried.js';
import type { LinesInFunctions } from './dry-run-files.js';
import {
    freshTestsIn,
    incrementalPlanned,
    plannedDryRun,
    plannedWritten,
    recordInputs,
} from './incremental.js';
import type { Planned, StaysInFunctions } from './incremental.js';
import { observedFrom } from './observed.js';

/** What the suite's dry run runs before its first mutant: the test files it keeps of those the record knows, `undefined` for every one, on how many workers; or no dry run at all, the record carrying each of the stage's mutants. */
export type DryRunScope =
    | { carried: number }
    | {
          files: undefined | { kept: number; known: number };
          workers: number;
      };

/** The ids of the carried compile errors the compiler still refuses on the tree as it stands, `undefined` where no checker opens on it: the compiler is the TypeScript driver's to run. */
export type CompileErrorsAmong = (
    project: string,
    mutants: readonly CarriedCompileError[],
) => Promise<ReadonlySet<string> | undefined>;

/** How a stage runs on its record: whether the sandbox builds first, from no report, on how many test runners, whether it writes the HTML report a person asked for, in which project, how a change, a mutated line and a carried compile error are read, and who hears what the suite's dry run runs. */
export type RecordedRun = {
    buildsFirst: boolean;
    cold: boolean;
    compileErrorsAmong: CompileErrorsAmong;
    concurrency: number;
    dryRunScoped: (scope: DryRunScope) => void;
    html: boolean;
    linesInFunctions: LinesInFunctions;
    project: string;
    staysInFunctions: StaysInFunctions;
};

type Scoped = { readonly exclude: readonly string[]; readonly mutated: readonly string[] };

const fileOfEntry = (entry: string): string => mutateEntryOf(entry)?.file ?? entry;

// invariant: a suite stage whose every mutant the record carries starts no Stryker and writes nothing of its record: the report it carries is the stage's, and the change since the record stays the next run's to read.
async function suiteRun(scope: Scoped, stage: Stage, run: RecordedRun): Promise<StageOutcome> {
    const { incremental, report: reportName } = STAGES[stage.name];
    const planned = incrementalPlanned(run.project, incremental, {
        cold: run.cold,
        staysInFunctions: run.staysInFunctions,
    });
    const carried = run.html
        ? undefined
        : await carriedOf({
              fresh: freshTestsIn(planned),
              instrumented: async () =>
                  await mutantsInstrumented(
                      run.project,
                      [...mutatedLines(stage.mutate).keys()],
                      IGNORERS_FILE,
                  ),
              mutate: stage.mutate,
              refusedAmong: async (uncompiled) =>
                  await run.compileErrorsAmong(run.project, uncompiled),
              report: planned.report,
              textOf: (file) => planned.texts.get(file),
          });
    if (carried?.running.size === 0) {
        run.dryRunScoped({ carried: carried.made });
        writeFileSync(
            join(run.project, MUTATION_OUTPUT, `${reportName}.json`),
            JSON.stringify(planned.report),
        );

        return { ranByTests: new Set(), report: heldReport(planned.report, stage.mutate) };
    }
    const mutate =
        carried === undefined
            ? stage.mutate
            : stage.mutate.filter((entry) => carried.running.has(fileOfEntry(entry)));
    const { carried: tests, dryRun } = plannedDryRun(planned, {
        lines: mutatedLines(mutate),
        linesInFunctions: run.linesInFunctions,
    });
    plannedWritten(run.project, incremental, planned);
    run.dryRunScoped({
        files: dryRun && { kept: dryRun.kept.length, known: dryRun.known },
        workers: run.concurrency,
    });

    return await ranAndRecorded(scope, { ...stage, mutate }, run, {
        carried: tests,
        inputs: planned.inputs,
        testFiles: dryRun?.kept,
    });
}

async function ranAndRecorded(
    scope: Scoped,
    stage: Stage,
    run: RecordedRun,
    {
        carried,
        inputs,
        testFiles,
    }: {
        carried: readonly ObservedTest[];
        inputs: Planned['inputs'];
        testFiles: readonly string[] | undefined;
    },
): Promise<StageOutcome> {
    const ran = await strykerRun(scope, stage, {
        buildsFirst: run.buildsFirst,
        concurrency: run.concurrency,
        html: run.html,
        project: run.project,
        testFiles,
    });
    if ('status' in ran) {
        return ran;
    }
    // invariant: a test file the dry run left out holds no test the change made stale, so what the last record says of its tests still holds and is carried into this one.
    const observed = observedFrom([...ran.observed, ...carried], inputs);
    recordInputs(run.project, STAGES[stage.name].incremental, { inputs: inputs ?? {}, observed });

    return { ranByTests: ran.ranByTests, report: ran.report };
}

/** Runs a stage on what its record keeps: the incremental report cut to what the change leaves standing, a suite's Stryker started only for the sources holding a mutant the record does not carry, its dry run limited to the test files that reach them, and, once the stage ends, what its tests ran written back. */
export async function recordedStageRun(
    scope: Scoped,
    stage: Stage,
    run: RecordedRun,
): Promise<StageOutcome> {
    if (stage.name === 'suite') {
        return await suiteRun(scope, stage, run);
    }
    const { incremental } = STAGES[stage.name];
    const planned = incrementalPlanned(run.project, incremental, {
        cold: run.cold,
        staysInFunctions: run.staysInFunctions,
    });
    plannedWritten(run.project, incremental, planned);

    return await ranAndRecorded(scope, stage, run, {
        carried: [],
        inputs: planned.inputs,
        testFiles: undefined,
    });
}
