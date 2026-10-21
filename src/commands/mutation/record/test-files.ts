import { objectOf, stringOf } from '../../../../lint/kit/project/json.js';
import { readManifest } from '../../../../lint/kit/project/manifest.js';
import { testFileOf } from '../../../../lint/kit/project/mutation-report.js';
import { STAGES } from '../../../../lint/kit/project/mutation-stages.js';
import { workspaceMembers } from '../../../../lint/kit/project/workspace-members.js';
import { branchBaseFor, pathsChangedSince } from '../branch.js';
import { codeTextsIn, recordedOf } from './incremental.js';
import { changedBetween, inputsOf, ownBuildOf, reachOf, roleOf } from './inputs.js';
import type { Inputs } from './inputs.js';
import { ranBy } from './observed.js';
import type { Observed } from './observed.js';
import { changedFilesOf, isStale } from './staleness.js';
import type { Staleness } from './staleness.js';

/** The test files a run of the tests runs: those the change reaches of the `total` the tree holds, or every one, and why the record cannot tell. */
export type TestFiles =
    | { files: readonly string[]; kind: 'reached'; total: number }
    | { kind: 'every'; reason: string };

const every = (reason: string): TestFiles => ({ kind: 'every', reason });

/**
 * The test files the change reaches: each holding a test the change made stale by the record of the suite's last dry run (its file changed, ground above it, a source it loads or its processes ran), and each test file the record does not know; every file where the change reaches a file every test reads, removes a module a test may have imported, or the record knows no test.
 * A file left out holds no test the change could make fail, by the same record that keeps a mutant's verdict standing (ADR-026, ADR-030).
 */
export function testFilesOf({
    changed,
    inputs,
    observed,
    staleness,
}: {
    changed: readonly string[];
    inputs: Inputs;
    observed: Observed;
    staleness: Staleness;
}): TestFiles {
    const everything = changed.find((path) => roleOf(path).kind === 'everything');
    if (everything !== undefined) {
        return every(`the change reaches ${everything}, which every test reads`);
    }
    // invariant: an import of a module that no longer exists names no file the reach can follow, so the record cannot say which test it breaks.
    const removed = changed.find(
        (path) => inputs[path] === undefined && roleOf(path).kind === 'source',
    );
    if (removed !== undefined) {
        return every(`the change removes ${removed}, and no record names the tests that import it`);
    }
    const tests = Object.keys(observed.tests)
        .map((key) => ({ file: testFileOf(key), key }))
        .filter(({ file }) => inputs[file] !== undefined);
    if (tests.length === 0) {
        return every('the record of the last dry run names no test');
    }
    const known = new Set(tests.map(({ file }) => file));
    const change = changedFilesOf(changed);
    const all = Object.keys(inputs).filter((path) => roleOf(path).kind === 'test');
    const files = new Set([
        ...tests.filter((test) => isStale(test, change, staleness)).map(({ file }) => file),
        ...all.filter((file) => !known.has(file)),
    ]);

    return { files: [...files].toSorted(), kind: 'reached', total: all.length };
}

// outside: the files are handed to the script after `--`, which only a script that is one vitest command reads as the files to run.
const ONE_VITEST = /^vitest(?:\s+[^\s&|;<>`$()]+)*$/u;

/** The project's own `test` script, empty where it keeps none. */
export const testScriptOf = (project: string): string =>
    stringOf(objectOf(readManifest(project)?.scripts).test)?.trim() ?? '';

/** The test files the change since the branch's base reaches in the project, read from the suite's record, or every one and why. */
export function testFilesReachedIn(project: string): TestFiles {
    if (workspaceMembers(project).length > 0) {
        return every('a workspace root, whose members each keep their own record');
    }
    if (!ONE_VITEST.test(testScriptOf(project))) {
        return every('the test script is not one vitest command, so it cannot be handed the files');
    }
    const recorded = recordedOf(project, STAGES.suite.incremental);
    const inputs = inputsOf(project);
    if (recorded === undefined || inputs === undefined) {
        return every('no record of what each test reaches, which `typescript mutation` leaves');
    }
    const base = branchBaseFor(project);
    const sinceBase = base === undefined ? undefined : pathsChangedSince(project, base);
    if (sinceBase === undefined) {
        return every('git names no commit the branch started from');
    }
    const reach = reachOf(
        codeTextsIn(project, inputs),
        ownBuildOf(readManifest(project) ?? undefined),
    );

    return testFilesOf({
        changed: [...new Set([...changedBetween(recorded.inputs, inputs), ...sinceBase])],
        inputs,
        observed: recorded.observed,
        staleness: {
            onlyFunctions: () => false,
            ranBy: ranBy(recorded.observed),
            reach,
        },
    });
}

// invariant: Vitest refuses a flag given twice, so a script whose own line already lets a run match no file is not told so again.
const filesArgs = (files: readonly string[], script: string): string[] => [
    ...(script.includes('--passWithNoTests') ? [] : ['--passWithNoTests']),
    ...files,
];

/** What a run hands the test script (`undefined` where it runs nothing, empty for every file) and the line it prints of what it ran. */
export function scriptRunOf(
    selection: TestFiles,
    script: string,
): { args: string[] | undefined; line: string } {
    if (selection.kind === 'every') {
        return { args: [], line: `ran every test file: ${selection.reason}` };
    }
    const { files, total } = selection;
    const line = `ran ${String(files.length)} of ${String(total)} test files the change reaches`;
    if (files.length === 0) {
        return { args: undefined, line };
    }

    return { args: files.length === total ? [] : filesArgs(files, script), line };
}
