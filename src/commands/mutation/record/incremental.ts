import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { MUTATION_OUTPUT } from '../../../../lint/kit/project/build-plan.js';
import { gitRun } from '../../../../lint/kit/project/git.js';
import { parsedObject, stringRecordOf } from '../../../../lint/kit/project/json.js';
import { readManifest } from '../../../../lint/kit/project/manifest.js';
import { testFileOf } from '../../../../lint/kit/project/mutation-report.js';
import { dryRunOf } from './dry-run-files.js';
import type { DryRunKept, DryRunOver } from './dry-run-files.js';
import { changedBetween, inputsOf, isLoadable, ownBuildOf, reachOf, roleOf } from './inputs.js';
import type { Inputs } from './inputs.js';
import { observedOf, observedOnDisk, ranBy } from './observed.js';
import type { Observed } from './observed.js';
import { changedFilesOf, isStale, reportAfter } from './staleness.js';
import type { Staleness } from './staleness.js';

/** Whether a change of a source, as git's diff names its lines between the source's two texts, reaches only what its functions do: the syntax is the TypeScript driver's to read. */
export type StaysInFunctions = (
    file: string,
    texts: { after: string; before: () => string },
    diff: string,
) => boolean;

/** What a stage starts on: the inputs it recorded, the test files its dry run keeps (`undefined` for all of them), and the tests of the record the dry run leaves out, which still hold. */
export type Kept = DryRunKept & { inputs: Inputs | undefined };

/** What the last run recorded beside its report: the inputs it ran on, and, once it ended, what its tests ran. */
export type StageRecord = { inputs: Inputs; observed?: Observed | undefined };

const recordPathOf = (project: string, incremental: string): string =>
    join(project, MUTATION_OUTPUT, `${incremental}.inputs.json`);

function jsonAt(path: string): Record<string, unknown> | undefined {
    // Stryker disable BlockStatement: a catch that returns nothing returns undefined, as its body does
    try {
        return parsedObject(String(readFileSync(path)));
    } catch {
        return undefined;
    }
    // Stryker restore BlockStatement
}

/** What a stage's last run recorded, or `undefined` where it left no record that parses. */
export function recordedOf(
    project: string,
    incremental: string,
): undefined | { inputs: Inputs; observed: Observed } {
    const recorded = jsonAt(recordPathOf(project, incremental));

    return recorded === undefined
        ? undefined
        : { inputs: stringRecordOf(recorded.inputs), observed: observedOf(recorded.observed) };
}

/** Writes what a run stands on beside its report: at its start, the inputs alone, so a run that never ends leaves no test it could follow; at its end, what its tests ran. */
export function recordInputs(
    project: string,
    incremental: string,
    { inputs, observed }: StageRecord,
): void {
    const onDisk =
        observed === undefined ? { inputs } : { inputs, observed: observedOnDisk(observed) };
    writeFileSync(recordPathOf(project, incremental), `${JSON.stringify(onDisk)}\n`);
}

// invariant: the text of every source a run started on is kept under its hash beside the record, so the next run can tell a change of what a function does from a change of what loading the module does; a text no longer recorded is pruned.
const textsOf = (project: string, incremental: string): string =>
    join(project, MUTATION_OUTPUT, `${incremental}.sources`);

function keptTexts(
    project: string,
    incremental: string,
    { inputs, texts }: { inputs: Inputs; texts: ReadonlyMap<string, string> },
): void {
    const folder = textsOf(project, incremental);
    mkdirSync(folder, { recursive: true });
    const wanted = new Set<string>();
    for (const [path, text] of texts) {
        if (roleOf(path).kind === 'source') {
            const hash = String(inputs[path]);
            wanted.add(hash);
            writeFileSync(join(folder, hash), text);
        }
    }
    for (const name of readdirSync(folder)) {
        if (!wanted.has(name)) {
            rmSync(join(folder, name));
        }
    }
}

function onlyFunctionsIn(
    project: string,
    incremental: string,
    {
        before,
        now,
        staysInFunctions,
    }: { before: Inputs; now: ReadonlyMap<string, string>; staysInFunctions: StaysInFunctions },
): (source: string) => boolean {
    return (source) => {
        const kept = join(textsOf(project, incremental), String(before[source]));
        // outside: `git diff --no-index` exits 1 when the two files differ, which is the answer read here.
        const diff = gitRun(project, [
            'diff',
            '--no-index',
            '--no-ext-diff',
            '--no-color',
            '--unified=0',
            '--',
            resolve(kept),
            resolve(project, source),
        ]);

        return staysInFunctions(
            source,
            { after: String(now.get(source)), before: () => String(readFileSync(kept)) },
            diff.stdout,
        );
    };
}

/** The text of every file of the inputs a test may load. */
export function codeTextsIn(project: string, inputs: Inputs): Map<string, string> {
    const code = Object.keys(inputs).filter((path) => isLoadable(path));

    return new Map(code.map((path) => [path, String(readFileSync(join(project, path)))]));
}

/** What a stage starts on before anything is written: the inputs it would record, the text of every file a test may load, and, where the last run left a record, how the change since it reads and the report it leaves standing (`undefined` where it leaves none). */
export type Planned = {
    inputs: Inputs | undefined;
    reading:
        | undefined
        | {
              changed: readonly string[];
              recorded: { inputs: Inputs; observed: Observed };
              staleness: Staleness;
          };
    report: Record<string, unknown> | undefined;
    texts: ReadonlyMap<string, string>;
};

/**
 * Reads what a stage's incremental report keeps of the change since its run, writing nothing: a cold start, or a project git cannot list, keeps no report and reads no record, since a verdict a gate stands on is never inherited from an earlier run, nor a dry run limited by one.
 */
export function incrementalPlanned(
    project: string,
    incremental: string,
    { cold, staysInFunctions }: { cold: boolean; staysInFunctions: StaysInFunctions },
): Planned {
    const inputs = inputsOf(project);
    if (inputs === undefined) {
        return { inputs, reading: undefined, report: undefined, texts: new Map() };
    }
    const recorded = cold ? undefined : recordedOf(project, incremental);
    const texts = codeTextsIn(project, inputs);
    if (recorded === undefined) {
        return { inputs, reading: undefined, report: undefined, texts };
    }
    const staleness: Staleness = {
        onlyFunctions: onlyFunctionsIn(project, incremental, {
            before: recorded.inputs,
            now: texts,
            staysInFunctions,
        }),
        ranBy: ranBy(recorded.observed),
        reach: reachOf(texts, ownBuildOf(readManifest(project) ?? undefined)),
    };
    const changed = changedBetween(recorded.inputs, inputs);
    const report = jsonAt(join(project, MUTATION_OUTPUT, `${incremental}.json`));

    return {
        inputs,
        reading: { changed, recorded, staleness },
        report: report === undefined ? undefined : reportAfter(report, changed, staleness),
        texts,
    };
}

/** The test files a suite's dry run keeps over the sources it mutates, and the tests of the record it leaves out, which still hold; every file, and nothing carried, where no record reads the change. */
export function plannedDryRun(planned: Planned, over: DryRunOver | undefined): DryRunKept {
    const { inputs, reading, texts } = planned;

    return inputs === undefined || reading === undefined
        ? { carried: [], dryRun: undefined }
        : dryRunOf(reading.recorded, {
              changed: reading.changed,
              inputs,
              over,
              staleness: reading.staleness,
              texts,
          });
}

/** Whether the change since the record made one of its tests stale or brought a test file it does not know: a test a run never saw judge a mutant may judge it now. */
export function freshTestsIn({ reading }: Planned): boolean {
    if (reading === undefined) {
        return true;
    }
    const change = changedFilesOf(reading.changed);

    return (
        change.tests.size > 0 ||
        Object.keys(reading.recorded.observed.tests).some((key) =>
            isStale({ file: testFileOf(key), key }, change, reading.staleness),
        )
    );
}

/** Writes what a stage starts on: the report it keeps, the inputs alone as its record, and the text of every source; a project git cannot list keeps neither report nor record. */
export function plannedWritten(project: string, incremental: string, planned: Planned): void {
    const file = join(project, MUTATION_OUTPUT, `${incremental}.json`);
    const { inputs, report, texts } = planned;
    if (inputs === undefined) {
        rmSync(file, { force: true });
        rmSync(recordPathOf(project, incremental), { force: true });

        return;
    }
    if (report === undefined) {
        rmSync(file, { force: true });
    } else {
        writeFileSync(file, JSON.stringify(report));
    }
    recordInputs(project, incremental, { inputs });
    keptTexts(project, incremental, { inputs, texts });
}

/**
 * Keeps of a stage's incremental report what the change since its run leaves standing, drops it whole where it cannot say, records the inputs this run starts on, and, for a suite, names the test files its dry run keeps.
 * A cold start drops it whatever changed: a verdict a gate stands on is never inherited from an earlier run, nor a dry run limited by one.
 */
export function incrementalKeptWhileInputsHold(
    project: string,
    incremental: string,
    {
        cold,
        dryRunOver,
        staysInFunctions,
    }: { cold: boolean; dryRunOver?: DryRunOver | undefined; staysInFunctions: StaysInFunctions },
): Kept {
    const planned = incrementalPlanned(project, incremental, { cold, staysInFunctions });
    const limited = plannedDryRun(planned, dryRunOver);
    plannedWritten(project, incremental, planned);

    return { ...limited, inputs: planned.inputs };
}
