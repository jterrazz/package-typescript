import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ARTIFACTS, MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';
import { listNotIgnored } from '../../../lint/kit/project/git-tree.js';
import { isList, objectOf, parsedObject, stringOf } from '../../../lint/kit/project/json.js';
import { isUnder, reachOf, roleOf } from './inputs.js';
import type { Reach } from './inputs.js';

/** Every file a run's tests may read, by its hash; the install stands for the toolchain git does not list. */
export type Inputs = Readonly<Record<string, string>>;

/** What the last run recorded beside its report: the inputs it ran on, and, once it ended, the tests it saw run without spawning a process. */
export type Recorded = { inputs: Inputs; quiet?: readonly string[] | undefined };

const INSTALL = 'node_modules/.package-lock.json';

const hashOf = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');

/** The hash of every file git lists in the project, ignored files and the output of runs aside, and of the install; `undefined` where git cannot list the tree, so no change could be told. */
export function inputsOf(project: string): Record<string, string> | undefined {
    // outside: the sweep that lists a project's files leaves a test's ground to its scenario, so the tree is asked of git directly.
    const listed = listNotIgnored(project);
    if (listed === null) {
        return undefined;
    }
    const inputs: Record<string, string> = {};
    for (const path of listed) {
        const file = join(project, path);
        if (
            !path.startsWith(`${ARTIFACTS}/`) &&
            statSync(file, { throwIfNoEntry: false })?.isFile() === true
        ) {
            inputs[path] = hashOf(readFileSync(file));
        }
    }
    const install = join(project, INSTALL);
    inputs[INSTALL] = existsSync(install) ? hashOf(readFileSync(install)) : 'absent';

    return inputs;
}

/** The paths whose bytes differ between two records of the inputs, a file added or removed included. */
export function changedBetween(before: Inputs, after: Inputs): string[] {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
        (path) => before[path] !== after[path],
    );
}

type Mutant = Record<string, unknown>;

const idsOf = (mutant: Mutant, key: 'coveredBy' | 'killedBy'): string[] => {
    const ids = mutant[key];

    return isList(ids) ? ids.map(String) : [];
};

type ReportTest = { file: string; key: string };

function testsOf(report: Record<string, unknown>): Map<string, ReportTest> {
    const tests = new Map<string, ReportTest>();
    for (const [file, entry] of Object.entries(objectOf(report.testFiles))) {
        const listed = objectOf(entry).tests;
        for (const test of isList(listed) ? listed : []) {
            const { id, name } = objectOf(test);
            tests.set(String(id), { file, key: `${file}#${stringOf(name) ?? ''}` });
        }
    }

    return tests;
}

type Change = { everything: boolean; grounds: string[]; sources: Set<string>; tests: Set<string> };

function changeOf(changed: readonly string[]): Change {
    const change: Change = { everything: false, grounds: [], sources: new Set(), tests: new Set() };
    for (const path of changed) {
        const role = roleOf(path);
        if (role.kind === 'everything') {
            change.everything = true;
        } else if (role.kind === 'ground') {
            change.grounds.push(role.root);
        } else if (role.kind === 'source') {
            change.sources.add(path);
        } else {
            change.tests.add(path);
        }
    }

    return change;
}

/** How a run reads a test's reach: the modules its file loads, and the tests it saw spawn no process. */
export type Staleness = { quiet: ReadonlySet<string>; reach: (file: string) => Reach };

// invariant: a test is stale when its file changed, when ground under a folder above it changed, when a source its own process can load changed, and — unless the last run saw it spawn no process — when any source changed: a spawned process may load the package's build, which holds them all.
function isStale(test: ReportTest, change: Change, { quiet, reach }: Staleness): boolean {
    if (change.tests.has(test.file) || change.grounds.some((root) => isUnder(test.file, root))) {
        return true;
    }
    if (change.sources.size === 0) {
        return false;
    }
    if (!quiet.has(test.key)) {
        return true;
    }
    const loads = reach(test.file);

    return loads.everything || [...change.sources].some((source) => loads.files.has(source));
}

/**
 * The report with every result the change could have moved taken out, so Stryker measures it again: each mutant of a source that changed, and each mutant a stale test covered or killed; `undefined` where a file every test reads changed, so nothing of the report holds.
 * Stryker keys a mutant by the text around it and a test by its own lines, so alone it would keep a kill a changed helper, fixture or setup file has outlived.
 */
export function reportAfter(
    report: Record<string, unknown>,
    changed: readonly string[],
    stale: Staleness,
): Record<string, unknown> | undefined {
    const change = changeOf(changed);
    if (change.everything) {
        return undefined;
    }
    const staleTests = new Set(
        [...testsOf(report)].filter(([, test]) => isStale(test, change, stale)).map(([id]) => id),
    );
    const files: Record<string, unknown> = {};
    for (const [file, entry] of Object.entries(objectOf(report.files))) {
        if (change.sources.has(file)) {
            continue;
        }
        const { mutants } = objectOf(entry);
        files[file] = {
            ...objectOf(entry),
            mutants: (isList(mutants) ? mutants : [])
                .map(objectOf)
                .filter(
                    (mutant) =>
                        ![...idsOf(mutant, 'coveredBy'), ...idsOf(mutant, 'killedBy')].some((id) =>
                            staleTests.has(id),
                        ),
                ),
        };
    }

    return { ...report, files };
}

const recordPathOf = (project: string, incremental: string): string =>
    join(project, MUTATION_OUTPUT, `${incremental}.inputs.json`);

function recordedOf(project: string, incremental: string): Recorded | undefined {
    try {
        const recorded = parsedObject(readFileSync(recordPathOf(project, incremental), 'utf8'));
        const { quiet } = recorded;

        return {
            inputs: Object.fromEntries(
                Object.entries(objectOf(recorded.inputs)).map(([path, hash]) => [
                    path,
                    String(hash),
                ]),
            ),
            quiet: isList(quiet) ? quiet.map(String) : undefined,
        };
    } catch {
        return undefined;
    }
}

/** Writes what a run stands on beside its report: at its start, the inputs alone, so a run that never ends leaves no test read as quiet; at its end, the tests it saw spawn no process. */
export function recordInputs(project: string, incremental: string, recorded: Recorded): void {
    writeFileSync(recordPathOf(project, incremental), `${JSON.stringify(recorded)}\n`);
}

function packageNameOf(project: string): string | undefined {
    try {
        const manifest = parsedObject(readFileSync(join(project, 'package.json'), 'utf8'));

        return stringOf(manifest.name) ?? undefined;
    } catch {
        return undefined;
    }
}

const textIn = (project: string, path: string): [string, string] => [
    path,
    String(readFileSync(join(project, path))),
];

function reachIn(project: string, inputs: Inputs): (file: string) => Reach {
    const code = Object.keys(inputs).filter((path) =>
        ['source', 'test'].includes(roleOf(path).kind),
    );

    return reachOf(new Map(code.map((path) => textIn(project, path))), packageNameOf(project));
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
    const kept =
        report === undefined || recorded === undefined || inputs === undefined
            ? undefined
            : reportAfter(report, changedBetween(recorded.inputs, inputs), {
                  quiet: new Set(recorded.quiet),
                  reach: reachIn(project, inputs),
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
    }

    return inputs;
}
