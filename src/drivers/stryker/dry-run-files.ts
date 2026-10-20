import type { Inputs } from './inputs.js';
import type { Observed } from './observed.js';
import { changeOf, isStale } from './staleness.js';
import type { ReportTest, Staleness } from './staleness.js';

/** A source a stage mutates, and whether every line it is mutated at sits inside a function, a type, a comment or a blank: `false` for a source mutated whole. */
export type MutatedSource = { file: string; inFunctions: boolean };

/** The test files a dry run keeps of those the record knows, and how many it knows. */
export type DryRunFiles = { kept: readonly string[]; known: number };

const fileOf = (key: string): string => key.split('#')[0] ?? key;

// invariant: a test can cover a mutant only where it reaches the mutant's source: its own process loads the source, or a process it spawned ran a function of it, or loaded it while a line mutated there sits outside every function; a test the record cannot follow reaches every source.
function reachesMutated(
    test: ReportTest,
    mutated: readonly MutatedSource[],
    staleness: Staleness,
): boolean {
    const loads = staleness.reach(test.file);
    const spawned = staleness.ranBy(test.key);

    return (
        loads.everything ||
        spawned === undefined ||
        mutated.some(
            ({ file, inFunctions }) =>
                loads.files.has(file) ||
                spawned.ran.has(file) ||
                (spawned.loaded.has(file) && !inFunctions),
        )
    );
}

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
    const change = changeOf(changed);
    const tests = Object.keys(observed.tests)
        .map((key) => ({ file: fileOf(key), key }))
        .filter(({ file }) => inputs[file] !== undefined);
    if (change.everything || tests.length === 0) {
        return undefined;
    }
    const known = new Set(tests.map(({ file }) => file));
    const kept = new Set(
        tests
            .filter(
                (test) =>
                    isStale(test, change, staleness) || reachesMutated(test, mutated, staleness),
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
