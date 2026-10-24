import { testFileOf } from '../../../../lint/kit/project/mutation-report.js';
import type { ObservedTest } from '../../../drivers/stryker/record-folders.js';
import type { Inputs } from './inputs.js';
import { observedTestsOf } from './observed.js';
import type { Observed } from './observed.js';
import { changedFilesOf, isStale, testReaches } from './staleness.js';
import type { Staleness } from './staleness.js';

/** A source a stage mutates, and whether every line it is mutated at sits inside a function, a type, a comment or a blank: `false` for a source mutated whole. */
export type MutatedSource = { file: string; inFunctions: boolean };

/** The test files a dry run keeps of those the record knows, and how many it knows. */
export type DryRunFiles = { kept: readonly string[]; known: number };

/**
 * The test files a suite's dry run keeps: each file holding a test the change made stale or that reaches a mutated source, and each test file added since the record, of those the tree still holds; `undefined`, every file, where the record knows no test, the change reaches a file every test reads, or no file is kept.
 * A test file the dry run leaves out holds no test that could cover a mutant of the stage, by the same record that keeps a verdict standing (ADR-026).
 */
export function dryRunFilesOf({
    changed,
    inputs,
    mutated,
    observed,
    staleness,
}: {
    changed: readonly string[];
    inputs: Inputs;
    mutated: readonly MutatedSource[];
    observed: Observed;
    staleness: Staleness;
}): DryRunFiles | undefined {
    const change = changedFilesOf(changed);
    const tests = Object.keys(observed.tests)
        .map((key) => ({ file: testFileOf(key), key }))
        .filter(({ file }) => inputs[file] !== undefined);
    if (change.everything || tests.length === 0) {
        return undefined;
    }
    const known = new Set(tests.map(({ file }) => file));
    // invariant: a test can cover a mutant only where it reaches the mutant's source, a spawned process that only loaded it reaching it while a line mutated there sits outside every function.
    const inFunctions = new Set(mutated.filter((one) => one.inFunctions).map(({ file }) => file));
    const reachOfMutated = {
        inFunctions: (file: string): boolean => inFunctions.has(file),
        sources: mutated.map(({ file }) => file),
    };
    const kept = new Set(
        tests
            .filter(
                (test) =>
                    isStale(test, change, staleness) ||
                    testReaches(test, staleness, reachOfMutated),
            )
            .map(({ file }) => file),
    );
    for (const file of change.tests) {
        if (!known.has(file) && inputs[file] !== undefined) {
            kept.add(file);
        }
    }

    // outside: Stryker reads an empty list of test files as every one of them.
    return kept.size === 0 ? undefined : { kept: [...kept].toSorted(), known: known.size };
}

/** Whether every line named of a source, counted from 1, sits inside a function, a type, a comment or a blank: the syntax is the TypeScript driver's to read. */
export type LinesInFunctions = (file: string, text: string, lines: readonly number[]) => boolean;

/** The sources a suite's dry run is limited to, each with the lines mutated there (`undefined` where it is mutated whole), and how their lines are read. */
export type DryRunOver = {
    lines: ReadonlyMap<string, readonly number[] | undefined>;
    linesInFunctions: LinesInFunctions;
};

/** The test files a dry run keeps, `undefined` for all of them, and the tests of the record it leaves out, which still hold. */
export type DryRunKept = {
    carried: readonly ObservedTest[];
    dryRun: DryRunFiles | undefined;
};

function mutatedSources(
    { lines, linesInFunctions }: DryRunOver,
    texts: ReadonlyMap<string, string>,
): MutatedSource[] {
    return [...lines].map(([file, held]) => {
        const text = texts.get(file);

        return {
            file,
            inFunctions:
                held !== undefined && text !== undefined && linesInFunctions(file, text, held),
        };
    });
}

/** The test files a suite's dry run keeps over the sources it mutates, read from the record, and the tests of the record it leaves out. */
export function dryRunOf(
    recorded: { inputs: Inputs; observed: Observed },
    {
        changed,
        inputs,
        over,
        staleness,
        texts,
    }: {
        changed: readonly string[];
        inputs: Inputs;
        over: DryRunOver | undefined;
        staleness: Staleness;
        texts: ReadonlyMap<string, string>;
    },
): DryRunKept {
    const dryRun =
        over === undefined
            ? undefined
            : dryRunFilesOf({
                  changed,
                  inputs,
                  mutated: mutatedSources(over, texts),
                  observed: recorded.observed,
                  staleness,
              });
    const left = new Set(dryRun?.kept);

    return {
        carried:
            dryRun === undefined
                ? []
                : observedTestsOf(recorded.observed, (test) => {
                      const file = testFileOf(test);

                      return !left.has(file) && inputs[file] !== undefined;
                  }),
        dryRun,
    };
}
