import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';
import { parsedObject, stringOf, stringRecordOf } from '../../../lint/kit/project/json.js';
import { changedBetween, inputsOf, reachOf, roleOf } from './inputs.js';
import type { Inputs } from './inputs.js';
import { observedOf, observedOnDisk, ranBy } from './observed.js';
import type { Observed } from './observed.js';
import { reportAfter } from './staleness.js';

/** Whether a change of a source, as git's diff names its lines between the source's two texts, reaches only what its functions do: the syntax is the TypeScript driver's to read. */
export type StaysInFunctions = (
    file: string,
    texts: { after: string; before: () => string },
    diff: string,
) => boolean;

/** What the last run recorded beside its report: the inputs it ran on, and, once it ended, what its tests ran. */
export type Recorded = { inputs: Inputs; observed?: Observed | undefined };

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

function recordedOf(
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
    { inputs, observed }: Recorded,
): void {
    const onDisk =
        observed === undefined ? { inputs } : { inputs, observed: observedOnDisk(observed) };
    writeFileSync(recordPathOf(project, incremental), `${JSON.stringify(onDisk)}\n`);
}

const packageNameOf = (project: string): string | undefined =>
    stringOf(jsonAt(join(project, 'package.json'))?.name) ?? undefined;

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
        const diff = spawnSync('git', [
            'diff',
            '--no-index',
            '--no-ext-diff',
            '--no-color',
            '--unified=0',
            '--',
            kept,
            join(project, source),
        ]);

        return staysInFunctions(
            source,
            { after: String(now.get(source)), before: () => String(readFileSync(kept)) },
            String(diff.stdout),
        );
    };
}

function codeTextsIn(project: string, inputs: Inputs): Map<string, string> {
    const code = Object.keys(inputs).filter((path) =>
        ['source', 'test'].includes(roleOf(path).kind),
    );

    return new Map(code.map((path) => [path, String(readFileSync(join(project, path)))]));
}

/**
 * Keeps of a stage's incremental report what the change since its run leaves standing, drops it whole where it cannot say, and records the inputs this run starts on.
 * A cold start drops it whatever changed: a verdict a gate stands on is never inherited from an earlier run.
 */
export function incrementalKeptWhileInputsHold(
    project: string,
    incremental: string,
    { cold, staysInFunctions }: { cold: boolean; staysInFunctions: StaysInFunctions },
): Inputs | undefined {
    const file = join(project, MUTATION_OUTPUT, `${incremental}.json`);
    const inputs = inputsOf(project);
    if (inputs === undefined) {
        rmSync(file, { force: true });
        rmSync(recordPathOf(project, incremental), { force: true });

        return undefined;
    }
    const recorded = cold ? undefined : recordedOf(project, incremental);
    const report = jsonAt(file);
    const texts = codeTextsIn(project, inputs);
    const kept =
        report === undefined || recorded === undefined
            ? undefined
            : reportAfter(report, changedBetween(recorded.inputs, inputs), {
                  onlyFunctions: onlyFunctionsIn(project, incremental, {
                      before: recorded.inputs,
                      now: texts,
                      staysInFunctions,
                  }),
                  ranBy: ranBy(recorded.observed),
                  reach: reachOf(texts, packageNameOf(project)),
              });
    if (kept === undefined) {
        rmSync(file, { force: true });
    } else {
        writeFileSync(file, JSON.stringify(kept));
    }
    recordInputs(project, incremental, { inputs });
    keptTexts(project, incremental, { inputs, texts });

    return inputs;
}
