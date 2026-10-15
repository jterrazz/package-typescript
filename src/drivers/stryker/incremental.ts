import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';
import { objectOf, parsedObject, stringOf } from '../../../lint/kit/project/json.js';
import { changesOnlyFunctions } from './change-shape.js';
import { changedBetween, inputsOf, reachOf, roleOf } from './inputs.js';
import type { Inputs } from './inputs.js';
import { observedOf, observedOnDisk, ranBy } from './observed.js';
import type { Observed } from './observed.js';
import { reportAfter } from './staleness.js';

/** What the last run recorded beside its report: the inputs it ran on, and, once it ended, what its tests ran. */
export type Recorded = { inputs: Inputs; observed?: Observed | undefined };

const recordPathOf = (project: string, incremental: string): string =>
    join(project, MUTATION_OUTPUT, `${incremental}.inputs.json`);

function recordedOf(project: string, incremental: string): Recorded | undefined {
    try {
        const recorded = parsedObject(readFileSync(recordPathOf(project, incremental), 'utf8'));

        return {
            inputs: Object.fromEntries(
                Object.entries(objectOf(recorded.inputs)).map(([path, hash]) => [
                    path,
                    String(hash),
                ]),
            ),
            observed: observedOf(recorded.observed),
        };
    } catch {
        return undefined;
    }
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

function packageNameOf(project: string): string | undefined {
    try {
        const manifest = parsedObject(readFileSync(join(project, 'package.json'), 'utf8'));

        return stringOf(manifest.name) ?? undefined;
    } catch {
        return undefined;
    }
}

// invariant: the text of every source a run started on is kept under its hash beside the record, so the next run can tell a change of what a function does from a change of what loading the module does; a text no longer recorded is pruned.
const textsOf = (project: string, incremental: string): string =>
    join(project, MUTATION_OUTPUT, `${incremental}.sources`);

function keptTexts(
    project: string,
    incremental: string,
    texts: ReadonlyMap<string, string>,
    inputs: Inputs,
): void {
    const folder = textsOf(project, incremental);
    mkdirSync(folder, { recursive: true });
    const wanted = new Set<string>();
    for (const [path, text] of texts) {
        const hash = inputs[path];
        if (hash !== undefined && roleOf(path).kind === 'source') {
            wanted.add(hash);
            if (!existsSync(join(folder, hash))) {
                writeFileSync(join(folder, hash), text);
            }
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
    { before, now }: { before: Inputs; now: ReadonlyMap<string, string> },
): (source: string) => boolean {
    return (source) => {
        const hash = before[source];
        const after = now.get(source);
        const kept = hash === undefined ? undefined : join(textsOf(project, incremental), hash);
        if (after === undefined || kept === undefined || !existsSync(kept)) {
            return false;
        }

        return changesOnlyFunctions(source, String(readFileSync(kept)), after);
    };
}

function codeTextsIn(project: string, inputs: Inputs): Map<string, string> {
    const code = Object.keys(inputs).filter((path) =>
        ['source', 'test'].includes(roleOf(path).kind),
    );

    return new Map(code.map((path) => [path, String(readFileSync(join(project, path)))]));
}

function reportIn(file: string): Record<string, unknown> | undefined {
    try {
        return parsedObject(readFileSync(file, 'utf8'));
    } catch {
        return undefined;
    }
}

/**
 * Keeps of a stage's incremental report what the change since its run leaves standing, drops it whole where it cannot say, and records the inputs this run starts on.
 * A cold start drops it whatever changed: a verdict a gate stands on is never inherited from an earlier run.
 */
export function incrementalKeptWhileInputsHold(
    project: string,
    incremental: string,
    { cold = false }: { cold?: boolean } = {},
): Inputs | undefined {
    const file = join(project, MUTATION_OUTPUT, `${incremental}.json`);
    const inputs = inputsOf(project);
    const recorded = cold || inputs === undefined ? undefined : recordedOf(project, incremental);
    const report = recorded === undefined ? undefined : reportIn(file);
    const texts = inputs === undefined ? new Map<string, string>() : codeTextsIn(project, inputs);
    const kept =
        report === undefined || recorded === undefined || inputs === undefined
            ? undefined
            : reportAfter(report, changedBetween(recorded.inputs, inputs), {
                  onlyFunctions: onlyFunctionsIn(project, incremental, {
                      before: recorded.inputs,
                      now: texts,
                  }),
                  ranBy: ranBy(recorded.observed),
                  reach: reachOf(texts, packageNameOf(project)),
              });
    if (kept === undefined) {
        rmSync(file, { force: true });
    } else {
        writeFileSync(file, JSON.stringify(kept));
    }
    if (inputs === undefined) {
        rmSync(recordPathOf(project, incremental), { force: true });
    } else {
        recordInputs(project, incremental, { inputs });
        keptTexts(project, incremental, texts, inputs);
    }

    return inputs;
}
